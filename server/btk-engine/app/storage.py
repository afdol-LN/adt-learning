from typing import Dict, Tuple
from app.models.bkt_kt_idem import SkillParams, ItemParams

# In-memory storage dictionaries
SKILLS: Dict[str, SkillParams] = {}
ITEMS: Dict[str, ItemParams] = {}
ITEMS_DIFFICULTY: Dict[str, int] = {}
STUDENT_MASTERY: Dict[Tuple[str, str], float] = {}  # key: (student_id, skill_id) -> value: p_l_current


def get_skill(skill_id: str) -> SkillParams:
    return SKILLS.get(skill_id)


def save_skill(skill_id: str, skill_params: SkillParams) -> None:
    skill_params.validate()
    SKILLS[skill_id] = skill_params


def get_item(item_id: str) -> ItemParams:
    return ITEMS.get(item_id)


def save_item(item_id: str, item_params: ItemParams, difficulty_label: int = 0) -> None:
    item_params.validate()
    ITEMS[item_id] = item_params
    ITEMS_DIFFICULTY[item_id] = difficulty_label


def get_item_difficulty(item_id: str) -> int:
    return ITEMS_DIFFICULTY.get(item_id, 0)


def get_student_mastery(student_id: str, skill_id: str) -> float:
    """Get current mastery probability P(L) for a student and skill.
    If not yet attempted, returns P(L0) of the skill or default 0.1.
    """
    if (student_id, skill_id) in STUDENT_MASTERY:
        return STUDENT_MASTERY[(student_id, skill_id)]
    skill = get_skill(skill_id)
    if skill:
        return skill.p_l0
    return 0.1


def save_student_mastery(student_id: str, skill_id: str, p_l: float) -> None:
    STUDENT_MASTERY[(student_id, skill_id)] = p_l


def clear_storage() -> None:
    """Helper for testing or resetting state."""
    SKILLS.clear()
    ITEMS.clear()
    ITEMS_DIFFICULTY.clear()
    STUDENT_MASTERY.clear()
