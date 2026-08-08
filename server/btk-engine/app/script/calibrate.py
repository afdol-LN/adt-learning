import os
import psycopg2
import pandas as pd 
from pyBKT.models import Model

DATABASE_URL = os.getenv("DATABASE_URL")

def run_calibration():
    conn = psycopg2.connect(DATABASE_URL)

    query = """
        SELECT 
            b.userId AS student_id,
            e.skill_id AS skill_name,
            se.exerciseId AS problem_name,
            CASE WHEN h.isCorrect = true THEN 1 ELSE 0 END AS correct,
            h.endTime AS timestamp
        FROM history h
        JOIN branch b ON h.branchId = b.id
        JOIN sessionAndExercise se ON h.sessionAndExerciseId = se.id
        JOIN exercise e ON se.exerciseId = e.id
        ORDER BY h.endTime ASC;
    """
    df = pd.read_sql(query, conn)

    if df.empty:
        conn.close()
        return

    defaults = {
        'user_id': 'student_id',
        'skill_name' : 'skill_name',
        'problem_name' : 'problem_name',
        'correct': 'correct'
    }

    model = Model()
    model.fit(data=df, multigs=True, defaults=defaults)

    cur = conn.cursor()

    # P(L0) และ P(T) เป็นค่าระดับ skill (KT-IDEM)
    coefs = model.coef_
    for skill_id, skill_params in coefs.items():
        new_p_l0 = float(skill_params['prior'])
        new_p_t = float(skill_params['learns'][0])

        cur.execute(
            "UPDATE skill SET p_l_0 = %s, p_t = %s WHERE skill_id = %s",
            (new_p_l0, new_p_t, int(skill_id))
        )

    # P(G) และ P(S) เป็นค่าระดับ item (KT-IDEM, multigs)
    params_df = model.params().reset_index()  # columns: skill, param, class, value
    for _, row in params_df[params_df['param'] == 'guesses'].iterrows():
        cur.execute(
            "UPDATE exercise SET p_g = %s WHERE id = %s",
            (float(row['value']), int(row['class']))
        )
    for _, row in params_df[params_df['param'] == 'slips'].iterrows():
        cur.execute(
            "UPDATE exercise SET p_s = %s WHERE id = %s",
            (float(row['value']), int(row['class']))
        )

    conn.commit()
    cur.close()
    conn.close()
    print("BKT parameters calibrated successfully (P(L0), P(T), P(G), P(S))!")

if __name__ == "__main__":
    run_calibration()
