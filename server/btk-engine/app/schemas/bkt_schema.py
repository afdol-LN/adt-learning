from pydantic import BaseModel, Field


class SkillCreate(BaseModel):
    skill_id: str = Field(..., examples=["control_flow"])
    p_l0: float = Field(0.1, ge=0.0, le=1.0, description="Prior knowledge P(L0)")
    p_t: float = Field(0.15, ge=0.0, le=1.0, description="Learning rate P(T)")


class SkillOut(BaseModel):
    skill_id: str = Field(..., examples=["control_flow"])
    p_l0: float = Field(..., ge=0.0, le=1.0, description="Prior knowledge P(L0)")
    p_t: float = Field(..., ge=0.0, le=1.0, description="Learning rate P(T)")


class ItemCreate(BaseModel):
    item_id: str = Field(..., examples=["cf-for-01"])
    skill_id: str = Field(..., examples=["control_flow"])
    p_g: float = Field(0.2, ge=0.0, le=1.0, description="Guess probability P(G)")
    p_s: float = Field(0.1, ge=0.0, le=1.0, description="Slip probability P(S)")
    difficulty_label: int = Field(0, ge=0, le=5, description="Level of each item")


class ItemOut(BaseModel):
    item_id: str
    skill_id: str
    p_g: float
    p_s: float
    difficulty_label: int


class AttemptIn(BaseModel):
    student_id: str = Field(..., examples=["std_001"])
    item_id: str = Field(..., examples=["cf-for-01"])
    correct: bool = Field(...)


# Alias for backward compatibility with possible typo during development
AttempIn = AttemptIn


class AttemptOut(BaseModel):
    student_id: str
    item_id: str
    skill_id: str
    p_l_prior: float
    p_l_posterior: float
    p_l_next: float
    predicted_correct_prob_next: float
    mastered: bool


class MasteryOut(BaseModel):
    student_id: str
    skill_id: str
    p_l: float
    mastered: bool


class MasteryThreshold(BaseModel):
    threshold: float = 0.95
