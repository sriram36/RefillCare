"""Measure prescription reading on labelled images.
Usage: python eval/run_eval.py <image folder> <labels.json>   (see labels.example.json)
Needs the AZURE_OPENAI_* variables. Without them nothing is read, so the script stops."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DB_PATH", "/tmp/eval.db")
import app as A

def main(folder, labels):
    if not os.getenv("AZURE_OPENAI_ENDPOINT"): sys.exit("Set the AZURE_OPENAI_* variables first.")
    hit = total = flagged = confident_wrong = unreadable = 0
    for name, lines in json.load(open(labels)).items():
        res = A.extract(open(os.path.join(folder, name), "rb").read(), ""); total += len(lines)
        if res["legible"] is not True: unreadable += 1; continue
        got = {}
        for l in res["lines"]:
            m, ratio = A.match(l["text"])
            if m: got[m["name"].split(",")[0]] = (int(l["qty"]), min(l["conf"], ratio))
        for t in lines:
            g = got.get(t["med"])
            if g and g[0] == t["qty"]: hit += 1; flagged += g[1] < .75
            elif g and g[1] >= .75: confident_wrong += 1  # wrong but not flagged: the case to drive to zero
    print(f"lines {total} | correct {hit} | correct but flagged for review {flagged} | wrong and confident {confident_wrong} | unreadable images {unreadable}")
if __name__ == "__main__": main(*sys.argv[1:3])
