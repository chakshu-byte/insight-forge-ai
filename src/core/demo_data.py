import pandas as pd
import streamlit as st


def get_dataset() -> pd.DataFrame:
    """
    Return the currently loaded dataset.

    If the user has uploaded a dataset, use that.
    Otherwise return the demo dataset.
    """

    if "dataset" in st.session_state:
        dataset = st.session_state["dataset"]

        if isinstance(dataset, pd.DataFrame):
            return dataset.copy()

    return pd.DataFrame(
        {
            "Month": [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
            ],
            "Failures": [
                105,
                118,
                143,
                166,
                195,
                214,
            ],
            "Failure": [
                "Overheating",
                "Battery",
                "Display",
                "Charging",
                "Keyboard",
                "Battery",
            ],
            "Severity": [
                "High",
                "Medium",
                "Low",
                "High",
                "Medium",
                "High",
            ],
            "Model": [
                "Latitude",
                "Inspiron",
                "XPS",
                "Precision",
                "Latitude",
                "XPS",
            ],
            "Issue": [
                "Overheating",
                "Battery Drain",
                "Display Flicker",
                "Charging Failure",
                "Keyboard Fault",
                "Thermal Shutdown",
            ],
        }
    )


def repair_logs() -> pd.DataFrame:
    """
    Return repair records for the dashboard.
    """
    return get_dataset()


def trend_data() -> pd.DataFrame:
    """
    Generate monthly failure trend data.
    """

    df = get_dataset()

    if "Month" not in df.columns:
        return pd.DataFrame(
            {
                "Month": [
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                ],
                "Failures": [
                    105,
                    118,
                    143,
                    166,
                    195,
                    214,
                ],
            }
        )

    month_order = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]

    if "Failures" in df.columns:

        trend = (
            df.groupby("Month", as_index=False)["Failures"]
            .sum()
        )

    else:

        trend = (
            df.groupby("Month")
            .size()
            .reset_index(name="Failures")
        )

    trend["Month"] = pd.Categorical(
        trend["Month"],
        categories=month_order,
        ordered=True,
    )

    return trend.sort_values("Month").reset_index(drop=True)


def distribution_data() -> pd.DataFrame:
    """
    Generate failure distribution data.
    """

    df = get_dataset()

    for column in [
        "Failure",
        "Failure Mode",
        "Category",
        "Type",
    ]:

        if column in df.columns:

            return (
                df.groupby(column)
                .size()
                .reset_index(name="Count")
                .rename(columns={column: "Failure"})
            )

    return pd.DataFrame(
        {
            "Failure": [
                "Overheating",
                "Battery",
                "Display",
                "Charging",
                "Keyboard",
            ],
            "Count": [
                41,
                25,
                17,
                10,
                7,
            ],
        }
    )
