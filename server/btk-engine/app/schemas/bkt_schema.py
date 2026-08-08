from pydantic import BaseModel, Field


class AttemptIn(BaseModel):
    p_l_current : float
    p_t : float
    p_g : float
    p_s : float 
    isCorrect : bool 
    response_time : float
    expect_time : float


# Alias for backward compatibility with possible typo during development
AttempIn = AttemptIn


class AttemptOut(BaseModel):
    p_l_prior: float
    p_l_posterior: float
    p_l_next: float
    predicted_correct_prob_next: float
    mastered: bool

