from urllib.parse import quote


def build_x_intent_url(text: str) -> str:
    return f"https://twitter.com/intent/tweet?text={quote(text[:280])}"
