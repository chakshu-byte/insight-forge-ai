import os

import pandas as pd
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")

if api_key:
    client = genai.Client(api_key=api_key)
else:
    client = None


def build_dataset_summary(
    df: pd.DataFrame,
    cost_per_model: dict = None,
    default_cost_per_unit: float = 0,
) -> str:
    """Create a compact analytical summary for Gemini."""

    summary = []

    # Basic information
    summary.append("DATASET OVERVIEW")
    summary.append(f"Total records: {len(df)}")
    summary.append(f"Total columns: {len(df.columns)}")

    # Missing values
    missing = df.isna().sum()
    missing = missing[missing > 0]

    summary.append("\nDATA QUALITY")
    if missing.empty:
        summary.append("No missing values detected.")
    else:
        for column, count in missing.items():
            summary.append(f"{column}: {count} missing values")

    # Severity
    if "Severity" in df.columns:
        severity_counts = df["Severity"].value_counts()

        summary.append("\nSEVERITY DISTRIBUTION")
        for severity, count in severity_counts.items():
            percentage = (count / len(df)) * 100
            summary.append(
                f"{severity}: {count} ({percentage:.1f}%)"
            )

    # Failure modes
    failure_column = (
        "Failure" if "Failure" in df.columns
        else "Issue" if "Issue" in df.columns
        else None
    )

    if failure_column:
        issue_counts = df[failure_column].value_counts().head(10)

        summary.append("\nTOP FAILURE MODES")
        for issue, count in issue_counts.items():
            summary.append(f"{issue}: {count}")

    # Product analysis
    if "Model" in df.columns:
        model_counts = df["Model"].value_counts().head(10)

        summary.append("\nTOP AFFECTED PRODUCTS")
        for model, count in model_counts.items():
            summary.append(f"{model}: {count}")

    # Cost impact
    cost_per_model = cost_per_model or {}

    if cost_per_model or default_cost_per_unit:

        if "Model" in df.columns:
            row_costs = (
                df["Model"]
                .astype(str)
                .map(lambda m: cost_per_model.get(m, default_cost_per_unit))
            )
            total_cost = row_costs.sum()
        else:
            total_cost = len(df) * default_cost_per_unit

        summary.append("\nESTIMATED COST IMPACT")
        summary.append(
            f"Total estimated cost: ₹{total_cost:,.0f} "
            f"({len(df)} records, per-model cost rates where set, "
            f"₹{default_cost_per_unit:,.0f} default otherwise)"
        )

        if "Model" in df.columns and cost_per_model:
            summary.append("Cost rate by product model:")
            for model, rate in cost_per_model.items():
                summary.append(f"{model}: ₹{rate:,.0f} per failure")

        if failure_column and "Model" in df.columns:
            mode_costs = (
                df.assign(_cost=row_costs)
                .groupby(failure_column)["_cost"]
                .sum()
                .sort_values(ascending=False)
                .head(5)
            )

            summary.append("Cost by top failure mode:")
            for mode, cost in mode_costs.items():
                summary.append(f"{mode}: ₹{cost:,.0f}")

    # Monthly trend
    if "Date" in df.columns:
        dates = pd.to_datetime(
            df["Date"],
            errors="coerce"
        )

        valid_dates = dates.dropna()

        if not valid_dates.empty:
            monthly = (
                valid_dates
                .dt.to_period("M")
                .value_counts()
                .sort_index()
            )

            summary.append("\nMONTHLY FAILURE TREND")

            for month, count in monthly.items():
                summary.append(
                    f"{month}: {count}"
                )

    elif "Month" in df.columns:
        month_order = [
            "Jan", "Feb", "Mar", "Apr",
            "May", "Jun", "Jul", "Aug",
            "Sep", "Oct", "Nov", "Dec",
        ]

        monthly = (
            df.groupby("Month", sort=False)["Failures"].sum()
            if "Failures" in df.columns
            else df.groupby("Month", sort=False).size()
        )

        monthly = monthly.reindex(
            [m for m in month_order if m in monthly.index]
        )

        summary.append("\nMONTHLY FAILURE TREND")

        for month, count in monthly.items():
            summary.append(f"{month}: {count}")

    return "\n".join(summary)


def generate_insights(
    df: pd.DataFrame,
    cost_per_model: dict = None,
    default_cost_per_unit: float = 0,
) -> str:
    """Generate engineering insights using Gemini."""

    if client is None:
        return (
            "Gemini API key not configured.\n\n"
            "Please add GEMINI_API_KEY to your .env file."
        )

    dataset_summary = build_dataset_summary(
        df, cost_per_model, default_cost_per_unit
    )

    prompt = f"""
You are a Senior Reliability Engineer analyzing
field-return failure data.

Use ONLY the analytical information provided below.
Do not invent statistics or facts.

{dataset_summary}

Generate a concise professional engineering analysis
with exactly these sections:

## Executive Summary
Give a short overview of the overall reliability situation.

## Top Failure Patterns
Identify the most important failure modes and severity patterns.

## Root Cause Hypotheses
Suggest likely engineering causes based on the observed patterns.
Clearly label these as hypotheses rather than confirmed causes.

## Engineering Recommendations
Give practical actions engineers should take. If cost impact
data is provided above, reference estimated ₹ savings or
exposure where relevant.

## Preventive Actions
Suggest concrete actions to reduce future field failures.

## Key Takeaways
Give 3 concise points that management should remember.

Keep the response professional, data-driven, and concise.
"""

    response = client.models.generate_content(
        model=gemini_model,
        contents=prompt,
    )

    return response.text