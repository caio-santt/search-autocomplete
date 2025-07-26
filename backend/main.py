from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
import sqlite3, unicodedata
from pathlib import Path

DB_PATH = Path(__file__).with_name("db") / "suggestions.db"

app = FastAPI(title="Suggest API", version="0.1.0")
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
conn.row_factory = sqlite3.Row

def strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))

@app.get("/suggest")
def suggest(term: str = Query(..., min_length=4, max_length=100)):
    """
    Retorna até 20 sugestões cujo prefixo (sem acento) combina com `term`.
    """
    norm = strip_accents(term).lower()
    sql  = "SELECT text, type FROM suggestions WHERE norm MATCH ? LIMIT 20"
    rows = conn.execute(sql, (f"{norm}*",)).fetchall()
    return JSONResponse([{"text": r["text"], "type": r["type"]} for r in rows])
