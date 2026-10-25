from quaketrace_pipeline.fixtures import asb14_rows

CSV = "\n".join(
    [
        "rup_mag,rup_rake,dist_rjb,site_vs30,result_type,damping,pga,pgv,0.3000,1.0000",
        "6,0,10,300,MEAN,5,1.5e-01,1.2e+01,3.1e-01,1.0e-01",
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
            "sa10G": 0.1,
        }
    ]
