from quaketrace_pipeline.fixtures import asb14_rows, ibb_district_totals

CSV = "\n".join(
    [
        "rup_mag,rup_rake,dist_rjb,site_vs30,result_type,damping,pga,pgv,0.3000,0.6000,1.0000",
        "6,0,10,300,MEAN,5,1.5e-01,1.2e+01,3.1e-01,2.2e-01,1.0e-01",
    ]
)


def test_asb14_rows_keep_inputs_and_selected_measures() -> None:
    assert asb14_rows(CSV) == [
        {
            "mw": 6.0,
            "rakeDeg": 0.0,
            "rjbKm": 10.0,
            "vs30": 300.0,
            "pgaG": 0.15,
            "pgvCms": 12.0,
            "sa03G": 0.31,
            "sa06G": 0.22,
            "sa10G": 0.1,
        }
    ]


IBB_CSV = "\n".join(
    [
        "ilce_adi;mahalle_adi;mahalle_koy_uavt;cok_agir_hasarli_bina_sayisi;agir_hasarli_bina_sayisi;"
        "orta_hasarli_bina_sayisi;hafif_hasarli_bina_sayisi;can_kaybi_sayisi",
        "EYÜP;A;1;1;2;3;4;5",
        "EYÜP;B;2;1;0;0;0;1",
        "ADALAR;C;3;0;1;0;0;2",
    ]
)


def test_ibb_totals_sum_neighbourhoods_per_district_with_renames() -> None:
    assert ibb_district_totals(IBB_CSV) == [
        {"name": "adalar", "veryHeavy": 0, "heavy": 1, "moderate": 0, "light": 0, "fatalities": 2},
        {
            "name": "eyüpsultan",
            "veryHeavy": 2,
            "heavy": 2,
            "moderate": 3,
            "light": 4,
            "fatalities": 6,
        },
    ]
