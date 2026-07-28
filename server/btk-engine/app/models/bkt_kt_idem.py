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

from dataclasses import dataclass

@dataclass
class SkillParams:
    """Skill-level parameters (shared across all items of that skill)."""
    p_l0: float  # P(L0): prior knowledge
    p_t: float   # P(T): learning/transit rate

    def validate(self) -> None:
        for name, value in (("p_l0", self.p_l0),("p_t", self.p_t)):
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be in [0,1], got {value}")
            
@dataclass
class ItemParams:
    """Item-level parameters (the 'IDEM' part of KT-IDEM)."""
    skill_id : str
    p_g: float  # P(G): guess probability for THIS item
    p_s: float  # P(S): slip probability for THIS item
    
    def validate(self)-> None:
        for name, value in (("p_g", self.p_g), ("p_s", self.p_s)):
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be in [0,1], got {value}")
            
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

def apply_learning_transition(p_l_posterior: float, p_t:float) -> float:
    """
    After incorporating evidence from the current attempt, the student may
    still transition from "not knowing" to "knowing" before the NEXT
    attempt. This is the standard BKT learning update.
    """
    return p_l_posterior + (1 - p_l_posterior) * p_t

def update_mastery(
        p_l_current: float,
        correct: bool,
        skill: SkillParams,
        item: ItemParams,
)-> dict:
    """
    Full KT-IDEM update step for a single attempt.

    Returns a dict with:
        p_l_prior      - mastery estimate going into this attempt
        p_l_posterior  - mastery estimate after observing correctness
        p_l_next       - mastery estimate after the learning transition
                         (this is what should be stored for the NEXT attempt)
    """
    skill.validate()
    item.validate()

    p_l_posterior = posterior_given_evidence(
        p_l_prior=p_l_current, correct=correct, p_g=item.p_g, p_s=item.p_s
    )
    p_l_next = apply_learning_transition(p_l_posterior, skill.p_t)

    return{
        "p_l_prior" : p_l_current,
        "p_l_posterior" : p_l_posterior,
        "p_l_next": p_l_next,
    }