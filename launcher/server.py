from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from launcher.api.routes import router as api_router
from fastapi.responses import FileResponse
import os

app = FastAPI(title="StoryForge")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api")

# Mount static files
app.mount("/static", StaticFiles(directory=os.path.join("launcher", "static")), name="static")
app.mount("/library", StaticFiles(directory="library"), name="library")

@app.get("/launcher")
async def read_launcher():
    return FileResponse(os.path.join("launcher", "static", "launcher.html"))

@app.get("/game/{game_id}")
async def read_game(game_id: str):
    # We serve the same template for all games
    return FileResponse(os.path.join("engine", "templates", "game.html"))
