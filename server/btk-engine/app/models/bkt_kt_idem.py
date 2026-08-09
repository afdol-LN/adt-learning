"""
KT-IDEM: Knowledge Tracing with Item Difficulty Effect Model.
 
Standard BKT has 4 parameters per SKILL:
    P(L0) - prior probability the student already knows the skill
    P(T)  - probability of learning the skill on any given opportunity
    P(G)  - probability of guessing correctly while NOT knowing the skill
    P(S)  - probability of a slip (getting it wrong while KNOWING the skill)
 
KT-IDEM's key change: P(G) and P(S) are estimated per ITEM instead of per
skill, since items that test the same skill can have very different
difficulty. P(L0) and P(T) remain per-skill.
"""

def ratio_time_response_exercise(response_time : float, expection_time : float)->float:
    """this calculate ratio between response time and exeption time per exercise"""
    if response_time < expection_time or response_time == expection_time :
        return 1.0
    else : 
        #สูตรผิดอยู่ไปอิงตาม notion 
        #เช่น expection_time = 60, response_time = 120 จะได้ return 0.5 
        return expection_time / response_time

def posterior_given_evidence(
        p_l_prior: float, correct: bool, p_g: float, p_s: float
)-> float:
    """
    Bayes' rule update: given the prior P(L) that a student knows the
    skill BEFORE this observation, compute the posterior P(L | evidence)
    using this item's guess/slip parameters.
    
    """
    if correct : 
        numerator = p_l_prior * (1 - p_s)
        denominator = numerator + (1 - p_l_prior) * p_g
    else:
        numerator = p_l_prior * p_s
        denominator = numerator + (1 - p_l_prior) * (1-p_g)

    if denominator == 0:
        return p_l_prior
    return numerator/denominator

def apply_learning_transition(p_l_posterior: float, p_t:float, ratio:float) -> float:
    """
    After incorporating evidence from the current attempt, the student may
    still transition from "not knowing" to "knowing" before the NEXT
    attempt. This is the standard BKT learning update, scaled by how
    promptly the student answered.
    """
    return p_l_posterior + (1 - p_l_posterior) * p_t * ratio

def update_mastery(
        p_l_current: float,
        correct: bool,
        p_g : float,
        p_s : float,
        p_t : float,
        response_time : float,
        expect_time : float
)-> dict:
    """
    Full KT-IDEM update step for a single attempt.

    Returns a dict with:
        p_l_prior      - mastery estimate going into this attempt
        p_l_posterior  - mastery estimate after observing correctness
        p_l_next       - mastery estimate after the learning transition
        (this is what should be stored for the NEXT attempt)
    """


    p_l_posterior = posterior_given_evidence(
        p_l_prior=p_l_current, correct=correct, p_g=p_g, p_s=p_s
    )
    time_ratio = ratio_time_response_exercise(response_time=response_time, expection_time=expect_time)
    p_l_next = apply_learning_transition(p_l_posterior=p_l_posterior, p_t=p_t, ratio = time_ratio)

    return{
        "p_l_prior" : p_l_current,
        "p_l_posterior" : p_l_posterior,
        "p_l_next": p_l_next,
    }
    
    
    