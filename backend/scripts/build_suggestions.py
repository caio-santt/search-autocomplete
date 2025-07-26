import json, unicodedata, re
from pathlib import Path
from collections import defaultdict

SRC = Path("../../../letterboxd/data/06-03-2025.json")  
DST = Path("../db/suggestions.json")

def strip_accents(txt: str) -> str:
    nfkd = unicodedata.normalize("NFD", txt)
    return "".join(c for c in nfkd if not unicodedata.combining(c))

def add_item(items, uid, text, typ, alias=None):
    norm = strip_accents(text).lower()
    item = {
        "id": uid,
        "text": text,
        "type": typ,
        "alias": alias or [],
        "norm": norm
    }
    items.append(item)

def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    movies = data["movies"]

    suggestions = []
    seen = set()          # p/ deduplicar norm

    for slug, movie in movies.items():
        info = movie["info"]

        # Filme
        add_item(suggestions, slug, info["originalName"], "movie",
                 alias=[info["name"]] if info["name"] != info["originalName"] else [])

        # Diretores
        for d in info["directors"]:
            uid = re.sub(r"[^a-z0-9]+", "-", strip_accents(d.lower())).strip("-")
            if uid not in seen:
                add_item(suggestions, uid, d, "director")
                seen.add(uid)

        # Elenco
        for actor in info["cast"]:
            uid = re.sub(r"[^a-z0-9]+", "-", strip_accents(actor.lower())).strip("-")
            if uid not in seen:
                add_item(suggestions, uid, actor, "actor")
                seen.add(uid)

    # dump
    DST.write_text(json.dumps(suggestions, ensure_ascii=False, indent=2), "utf-8")
    print(f"{len(suggestions)} sugestões gravadas em {DST}")

if __name__ == "__main__":
    main()
