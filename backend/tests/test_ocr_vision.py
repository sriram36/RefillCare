import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from rules import validate_doctor_reg
from services import ocr

def test_validate_doctor_reg_formats():
    # Valid WBMC format
    res_wb = validate_doctor_reg("WBMC-49281")
    assert res_wb["valid"] is True
    assert res_wb["council"] == "West Bengal Medical Council (WBMC)"
    assert "49281" in res_wb["reg_number"]

    # Valid NMC / Central format
    res_nmc = validate_doctor_reg("NMC/2021/88765")
    assert res_nmc["valid"] is True
    assert res_nmc["council"] == "National Medical Commission (NMC)"

    # Valid raw digits
    res_num = validate_doctor_reg("54321")
    assert res_num["valid"] is True

    # Invalid empty or gibberish
    res_inv = validate_doctor_reg("")
    assert res_inv["valid"] is False

    res_short = validate_doctor_reg("A")
    assert res_short["valid"] is False

def test_ocr_extract_demo():
    # Extract clean demo
    res = ocr.extract(b"", "clean")
    assert res["legible"] is True
    assert len(res["lines"]) >= 2
    assert res["lines"][0]["text"] == "Metformin 500 mg"
    assert res["lines"][0]["qty"] == 4

    # Extract blurry demo
    res_blurry = ocr.extract(b"", "blurry")
    assert res_blurry["legible"] is False

