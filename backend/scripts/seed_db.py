"""
Lê db/suggestions.json -> gera db/suggestions.db com FTS5 prefix‑search.
Executado no build da imagem Docker.
"""

import json, unicodedata, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]      
JSON_PATH = ROOT / "db" / "suggestions.json"
DB_PATH   = ROOT / "db" / "suggestions.db"

def strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))

def main() -> None:
    DB_PATH.unlink(missing_ok=True)           
    conn = sqlite3.connect(DB_PATH)
    conn.enable_load_extension(True)
    conn.executescript("""
        CREATE VIRTUAL TABLE suggestions USING fts5(
            id UNINDEXED,
            text,
            type UNINDEXED,
            norm,
            tokenize = 'unicode61 remove_diacritics 2'
        );
    """)

    items = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    rows = [
        (itm["id"], itm["text"], itm["type"],
         strip_accents(itm["text"]).lower())
        for itm in items
    ]
    conn.executemany(
        "INSERT INTO suggestions (id, text, type, norm) VALUES (?,?,?,?)", rows
    )
    conn.commit()
    print(f"Seed concluído: {len(rows)} registros -> {DB_PATH}")

if __name__ == "__main__":
    main()
