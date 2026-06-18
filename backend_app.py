from flask import Flask, request, jsonify
from flask_cors import CORS
from rag_engine import load_vectorstore, build_qa_chain, preprocess_query

app = Flask(__name__)
CORS(app)

print("🔹 Loading FAISS vectorstore and initializing RAG pipeline...")
vector_store = load_vectorstore()
qa_chain, log_top_matches = build_qa_chain(vector_store)

# Simple conversation memory
chat_history = []


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "message": "Backend running successfully."
    })


@app.route("/query", methods=["POST"])
def query():
    try:
        # Read request
        data = request.get_json(force=True, silent=True) or {}
        user_query = data.get("query", "") or data.get("question", "")

        processed_query = preprocess_query(user_query)

        # Add conversation memory
        history_context = "\n".join(chat_history[-6:])

        if history_context:
            processed_query = f"""
Previous Conversation:
{history_context}

Current Question:
{processed_query}
"""

        print(f"\n🧠 User Query: {user_query}")
        print(f"🔍 Processed Query: {processed_query}")

        # Show retrieval logs
        log_top_matches(processed_query)

        print("🔧 Running RAG pipeline...")

        try:
            response = qa_chain.invoke({
                "query": processed_query
            })

        except Exception:
            try:
                response = qa_chain.invoke({
                    "question": processed_query
                })

            except Exception:
                print("⚠️ Using manual fallback LLM call")

                docs = qa_chain.retriever.get_relevant_documents(
                    processed_query
                )

                context = "\n\n".join(
                    [d.page_content for d in docs[:5]]
                )

                prompt = f"""
Question:
{processed_query}

Context:
{context}
"""

                answer_text = (
                    qa_chain
                    .combine_documents_chain
                    .llm_chain
                    .llm
                    .invoke(prompt)
                )

                if hasattr(answer_text, "content"):
                    answer_text = answer_text.content

                response = {
                    "result": answer_text,
                    "source_documents": docs
                }

        # Extract answer
        answer = response.get(
            "result",
            "No answer generated."
        )

        try:
            if hasattr(answer, "content"):
                answer = answer.content

            elif (
                "content='" in str(answer)
                and "response_metadata" in str(answer)
            ):
                text = str(answer)

                start = (
                    text.find("content='")
                    + len("content='")
                )

                end = text.find(
                    "' response_metadata"
                )

                answer = text[start:end]

            else:
                answer = str(answer)

        except Exception:
            answer = str(answer)

        # Save memory
        chat_history.append(
            f"User: {user_query}"
        )

        chat_history.append(
            f"Assistant: {answer}"
        )

        # Keep only recent memory
        if len(chat_history) > 20:
            chat_history[:] = chat_history[-20:]

        source_docs = response.get(
            "source_documents",
            []
        )

        sources = []

        for doc in source_docs:
            meta = doc.metadata or {}

            sources.append({
                "type": meta.get(
                    "type",
                    "unknown"
                ),
                "file": meta.get(
                    "source",
                    "unknown"
                ),
                "title": meta.get(
                    "section_heading",
                    meta.get(
                        "case_title",
                        "N/A"
                    )
                ),
                "preview": doc.page_content[:200]
                .replace("\n", " "),
                "link": meta.get(
                    "pdf_url",
                    None
                )
            })

        return jsonify({
            "query": user_query,
            "answer": answer.strip(),
            "sources": sources
        })

    except Exception as e:
        import traceback
        traceback.print_exc()

        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=8000,
        debug=True
    )