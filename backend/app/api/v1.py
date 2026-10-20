"""Versioned product routes: validation, service calls and typed serialization only."""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from sqlalchemy import Engine

from app.analytics.service import AnalysisWindow, AnalyticsService
from app.api.errors import ApiNotFoundError
from app.db.session import get_engine
from app.games.definitions import GAMES
from app.schemas.v1 import (
    CheckIn,
    CheckOut,
    DrawOut,
    DrawPageOut,
    GameOut,
    GamesOut,
    GenerateIn,
    GenerateOut,
    NumberDetailOut,
    NumbersOut,
    PairDetailOut,
    PairsOut,
    PrizesOut,
    StatusOut,
    StrictBody,
    SyncOut,
    WindowIn,
)
from app.services.checker import CheckerService
from app.services.generator import GeneratorService
from app.services.history import DrawHistoryService
from app.services.prizes import DrawPrizeService
from app.services.status import game_status
from app.services.sync import ManualSyncService

router = APIRouter(prefix="/api/v1", tags=["v1"])
Database = Annotated[Engine, Depends(get_engine)]


def get_prize_service(engine: Database) -> DrawPrizeService:
    return DrawPrizeService(engine)


def get_sync_service(engine: Database) -> ManualSyncService:
    return ManualSyncService(engine)


@router.post("/games/{game}/sync", response_model=SyncOut)
def sync_game(
    game: str, _body: StrictBody, service: Annotated[ManualSyncService, Depends(get_sync_service)]
) -> SyncOut:
    return SyncOut.model_validate(service.sync(game))


def analysis_window(
    window: Literal["last_draws", "date_range", "all_time"],
    count: int | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> AnalysisWindow:
    return WindowIn(kind=window, count=count, from_date=from_date, to_date=to_date).to_domain()


Window = Annotated[AnalysisWindow, Depends(analysis_window)]


@router.get("/games", response_model=GamesOut)
def games() -> GamesOut:
    return GamesOut(
        items=tuple(
            GameOut(
                id=definition.id.value,
                label=definition.label,
                main_count=definition.main_count,
                main_min=definition.main_min,
                main_max=definition.main_max,
                special_min=definition.special_min,
                special_max=definition.special_max,
            )
            for definition in GAMES.values()
        )
    )


@router.get("/games/{game}/status", response_model=StatusOut)
def status(game: str, engine: Database) -> StatusOut:
    return StatusOut.model_validate(game_status(engine, game))


@router.get("/games/{game}/draws/latest", response_model=DrawOut)
def latest_draw(game: str, engine: Database) -> DrawOut:
    draw = DrawHistoryService(engine).latest(game)
    if draw is None:
        raise ApiNotFoundError("no_draws", "No draws are stored for this game")
    return DrawOut.model_validate(draw)


@router.get("/games/{game}/draws", response_model=DrawPageOut)
def draws(
    game: str,
    engine: Database,
    from_date: date | None = None,
    to_date: date | None = None,
    draw_id: str | None = None,
    page: int = 1,
    page_size: int = 25,
    sort: Literal["asc", "desc"] = "desc",
) -> DrawPageOut:
    return DrawPageOut.model_validate(
        DrawHistoryService(engine).list_draws(
            game,
            from_date=from_date,
            to_date=to_date,
            draw_id=draw_id,
            page=page,
            page_size=page_size,
            sort=sort,
        )
    )


@router.get("/games/{game}/draws/{draw_id}", response_model=DrawOut)
def draw_by_id(game: str, draw_id: str, engine: Database) -> DrawOut:
    draw = DrawHistoryService(engine).by_id(game, draw_id)
    if draw is None:
        raise ApiNotFoundError("draw_not_found", "Draw was not found")
    return DrawOut.model_validate(draw)


@router.get("/games/{game}/draws/{draw_id}/prizes", response_model=PrizesOut)
def draw_prizes(
    game: str, draw_id: str, service: Annotated[DrawPrizeService, Depends(get_prize_service)]
) -> PrizesOut:
    details = service.get(game, draw_id)
    if details is None:
        raise ApiNotFoundError("draw_not_found", "Draw was not found")
    return PrizesOut.model_validate(details)


@router.get("/games/{game}/analytics/numbers", response_model=NumbersOut)
def numbers(
    game: str,
    engine: Database,
    window: Window,
    as_of_draw_id: str | None = None,
    sort: Literal["number", "frequency_desc", "frequency_asc", "gap_desc"] = "number",
) -> NumbersOut:
    context, items = AnalyticsService(engine).numbers(
        game, window, as_of_draw_id=as_of_draw_id, sort=sort
    )
    return NumbersOut.model_validate({"context": context, "items": items})


@router.get("/games/{game}/analytics/numbers/{number}", response_model=NumberDetailOut)
def number_detail(
    game: str,
    number: int,
    engine: Database,
    window: Window,
    as_of_draw_id: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> NumberDetailOut:
    return NumberDetailOut.model_validate(
        AnalyticsService(engine).number_detail(
            game,
            number,
            window,
            as_of_draw_id=as_of_draw_id,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/games/{game}/analytics/pairs", response_model=PairsOut)
def pairs(
    game: str,
    engine: Database,
    window: Window,
    as_of_draw_id: str | None = None,
    min_frequency: int = 0,
    sort: Literal["frequency_desc", "frequency_asc", "pair"] = "frequency_desc",
    page: int = 1,
    page_size: int = 25,
) -> PairsOut:
    context, result = AnalyticsService(engine).pairs(
        game,
        window,
        as_of_draw_id=as_of_draw_id,
        min_frequency=min_frequency,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return PairsOut.model_validate(
        {
            "context": context,
            "items": result.items,
            "page": result.page,
            "page_size": result.page_size,
            "total": result.total,
        }
    )


@router.get("/games/{game}/analytics/pairs/{a}/{b}", response_model=PairDetailOut)
def pair_detail(
    game: str,
    a: int,
    b: int,
    engine: Database,
    window: Window,
    as_of_draw_id: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> PairDetailOut:
    return PairDetailOut.model_validate(
        AnalyticsService(engine).pair_detail(
            game,
            a,
            b,
            window,
            as_of_draw_id=as_of_draw_id,
            page=page,
            page_size=page_size,
        )
    )


@router.post("/games/{game}/combinations/check", response_model=CheckOut)
def check(game: str, body: CheckIn, engine: Database) -> CheckOut:
    return CheckOut.model_validate(
        CheckerService(engine).check(
            game,
            tuple(body.main_numbers),
            body.analysis_window.to_domain(),
            as_of_draw_id=body.as_of_draw_id,
            similar_page=body.similar_page,
            similar_page_size=body.similar_page_size,
        )
    )


@router.post("/games/{game}/combinations/generate", response_model=GenerateOut)
def generate(game: str, body: GenerateIn, engine: Database) -> GenerateOut:
    return GenerateOut.model_validate(
        GeneratorService(engine).generate(
            game,
            body.analysis_window.to_domain(),
            body.rules.to_domain(),
            requested_count=body.requested_count,
            seed=body.seed,
            reference_date=body.reference_date,
            as_of_draw_id=body.as_of_draw_id,
        )
    )
