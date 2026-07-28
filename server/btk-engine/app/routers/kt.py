from fastapi import APIRouter, HTTPException, status
from app.schemas.bkt_schema import (
    SkillCreate,
    SkillOut,
    ItemCreate,
    ItemOut,
    AttemptIn,
    AttemptOut,
    MasteryOut,
)
from app.service import kt_service

router = APIRouter(prefix="/kt", tags=["knowledge-tracing"])


@router.post(
    "/skill", response_model=SkillOut, status_code=status.HTTP_201_CREATED
)
def create_skill(payload: SkillCreate):
    try:
        return kt_service.register_skill(payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )


@router.get("/skill/{skill_id}", response_model=SkillOut)
def get_skill(skill_id: str):
    res = kt_service.get_skill(skill_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill not found: {skill_id}",
        )
    return res


@router.post(
    "/item", response_model=ItemOut, status_code=status.HTTP_201_CREATED
)
def create_item(payload: ItemCreate):
    try:
        return kt_service.register_item(payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )


@router.get("/item/{item_id}", response_model=ItemOut)
def get_item(item_id: str):
    res = kt_service.get_item(item_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item not found: {item_id}",
        )
    return res


@router.post(
    "/attempt", response_model=AttemptOut, status_code=status.HTTP_201_CREATED
)
def submit_attempt(payload: AttemptIn):
    try:
        return kt_service.process_attempt(payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )


@router.get("/mastery/{student_id}/{skill_id}", response_model=MasteryOut)
def get_mastery(student_id: str, skill_id: str):
    return kt_service.get_mastery(student_id, skill_id)
