from fastapi import APIRouter, HTTPException, status
from app.schemas.bkt_schema import (
    AttemptIn,
    AttemptOut,
)
from app.service import kt_service

from app.script import calibrate
router = APIRouter(prefix="/kt", tags=["knowledge-tracing"])



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


@router.post("/calibrate")
def trigger_calibration():
    try:
        # เรียกฟังก์ชันคำนวณที่เราเขียนไว้ (เหมือนวิธีที่ 1)
        calibrate.run_calibration()
        return {"status": "success", "message": "Calibrated parameters"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
