from typing import Optional
from app import storage
from app.models.bkt_kt_idem import SkillParams, ItemParams, update_mastery
from app.schemas.bkt_schema import (
    SkillCreate,
    SkillOut,
    ItemCreate,
    ItemOut,
    AttemptIn,
    AttemptOut,
    MasteryOut,
)

MASTERY_THRESHOLD = 0.95


def register_skill(dto: SkillCreate) -> SkillOut:
    params = SkillParams(p_l0=dto.p_l0, p_t=dto.p_t)
    storage.save_skill(dto.skill_id, params)
    return SkillOut(skill_id=dto.skill_id, p_l0=dto.p_l0, p_t=dto.p_t)


def get_skill(skill_id: str) -> Optional[SkillOut]:
    params = storage.get_skill(skill_id)
    if not params:
        return None
    return SkillOut(skill_id=skill_id, p_l0=params.p_l0, p_t=params.p_t)


def register_item(dto: ItemCreate) -> ItemOut:
    params = ItemParams(skill_id=dto.skill_id, p_g=dto.p_g, p_s=dto.p_s)
    storage.save_item(dto.item_id, params, dto.difficulty_label)
    return ItemOut(
        item_id=dto.item_id,
        skill_id=dto.skill_id,
        p_g=dto.p_g,
        p_s=dto.p_s,
        difficulty_label=dto.difficulty_label,
    )


def get_item(item_id: str) -> Optional[ItemOut]:
    params = storage.get_item(item_id)
    if not params:
        return None
    difficulty = storage.get_item_difficulty(item_id)
    return ItemOut(
        item_id=item_id,
        skill_id=params.skill_id,
        p_g=params.p_g,
        p_s=params.p_s,
        difficulty_label=difficulty,
    )


def process_attempt(dto: AttemptIn) -> AttemptOut:
    item = storage.get_item(dto.item_id)
    if not item:
        raise ValueError(f"Item not found: {dto.item_id}")

    skill = storage.get_skill(item.skill_id)
    if not skill:
        raise ValueError(f"Skill not found for item {dto.item_id}: {item.skill_id}")

    p_l_current = storage.get_student_mastery(dto.student_id, item.skill_id)

    # Perform KT-IDEM update
    res = update_mastery(
        p_l_current=p_l_current, correct=dto.correct, skill=skill, item=item
    )

    # Save new mastery state for next attempt
    p_l_next = res["p_l_next"]
    storage.save_student_mastery(dto.student_id, item.skill_id, p_l_next)

    # Predicted probability of correct answer on next attempt
    predicted_correct_prob_next = (
        p_l_next * (1 - item.p_s) + (1 - p_l_next) * item.p_g
    )
    mastered = p_l_next >= MASTERY_THRESHOLD

    return AttemptOut(
        student_id=dto.student_id,
        item_id=dto.item_id,
        skill_id=item.skill_id,
        p_l_prior=res["p_l_prior"],
        p_l_posterior=res["p_l_posterior"],
        p_l_next=p_l_next,
        predicted_correct_prob_next=predicted_correct_prob_next,
        mastered=mastered,
    )


def get_mastery(student_id: str, skill_id: str) -> MasteryOut:
    p_l = storage.get_student_mastery(student_id, skill_id)
    mastered = p_l >= MASTERY_THRESHOLD
    return MasteryOut(
        student_id=student_id, skill_id=skill_id, p_l=p_l, mastered=mastered
    )
