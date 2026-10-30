"""Cloud entrypoint: read the platform port without nested shell quoting."""

import os

import uvicorn


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "10000")),
        workers=1,
        limit_concurrency=16,
    )


if __name__ == "__main__":
    main()
