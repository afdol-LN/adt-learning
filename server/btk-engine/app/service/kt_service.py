from typing import Optional
from app.models.bkt_kt_idem import update_mastery
from app.schemas.bkt_schema import (
    AttemptIn,
    AttemptOut,
)

MASTERY_THRESHOLD = 0.95

def process_attempt(dto: AttemptIn) -> AttemptOut:

    # Perform KT-IDEM update
    res = update_mastery(
        p_l_current=dto.p_l_current,
        correct=dto.isCorrect,
        p_g=dto.p_g,
        p_s=dto.p_s,
        p_t=dto.p_t,
        response_time=dto.response_time,
        expect_time=dto.expect_time
    )

    # Save new mastery state for next attempt
    p_l_next = res["p_l_next"]
    # Predicted probability of correct answer on next attempt
    predicted_correct_prob_next = (
        p_l_next * (1 -dto.p_s) + (1 - p_l_next) * dto.p_g
    )
    mastered = p_l_next >= MASTERY_THRESHOLD

    return AttemptOut(
        p_l_prior=res["p_l_prior"],
        p_l_posterior=res["p_l_posterior"],
        p_l_next=p_l_next,
        predicted_correct_prob_next=predicted_correct_prob_next,
        mastered=mastered,
    )

