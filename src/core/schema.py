"""
Canonical Dataset Schema

Defines the canonical column names InsightForge AI standardizes on,
and provides a single normalization function used everywhere the
app reads the uploaded dataset.
"""

import pandas as pd


# ============================================================
# CANONICAL SCHEMA
# ============================================================
# Maps each canonical column name to the list of raw column
# names (case-insensitive, whitespace-insensitive) that should
# be treated as that column.

COLUMN_ALIASES = {
    "ID": ["id", "record id", "return id", "fr id"],
    "Month": ["month"],
    "Date": ["date", "failure date", "return date"],
    "Failures": ["failures", "failure count", "count"],
    "Failure": [
        "failure", "failure mode", "issue",
        "category", "type", "defect",
    ],
    "Severity": ["severity", "priority"],
    "Model": ["model", "product model", "product"],
    "Repair Date": ["repair date", "resolved date", "fix date"],
    "Status": ["status", "repair status"],
}


def _clean_column_name(name: str) -> str:
    """Lowercase and strip a column name for matching purposes."""
    return str(name).strip().lower()


def normalize_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return a copy of df with columns renamed to canonical names
    wherever a recognized alias is found.

    - Does not drop any columns; unrecognized columns are kept as-is.
    - If multiple raw columns map to the same canonical name,
      the first match (in column order) wins.
    - Does not mutate the original dataframe.
    """

    if df is None or df.empty:
        return df

    df = df.copy()
    df.columns = df.columns.astype(str).str.strip()

    rename_map = {}
    claimed_canonical_names = set()

    for raw_column in df.columns:
        cleaned = _clean_column_name(raw_column)

        for canonical_name, aliases in COLUMN_ALIASES.items():
            if canonical_name in claimed_canonical_names:
                continue

            if cleaned == canonical_name.lower() or cleaned in aliases:
                rename_map[raw_column] = canonical_name
                claimed_canonical_names.add(canonical_name)
                break

    return df.rename(columns=rename_map)


def get_cost_impact(
    df: pd.DataFrame,
    cost_per_model: dict,
    default_cost: float = 0,
) -> dict:
    """
    Compute total, per-failure-mode, and per-model cost impact
    from an already-normalized dataframe.

    cost_per_model: dict mapping Model -> cost per failure for
    that model. Models not present in the dict fall back to
    default_cost.

    Returns a dict with:
      - total_cost: float
      - by_mode: DataFrame with columns [Failure, Count, Cost],
        sorted by Cost descending (empty DataFrame if no
        failure-mode column is present)
      - by_model: DataFrame with columns [Model, Count, Cost],
        sorted by Cost descending (empty DataFrame if no
        Model column is present)
    """

    empty_result = {
        "total_cost": 0.0,
        "by_mode": pd.DataFrame(),
        "by_model": pd.DataFrame(),
    }

    if df is None or df.empty:
        return empty_result

    cost_per_model = cost_per_model or {}

    failure_column = (
        "Failure" if "Failure" in df.columns
        else "Issue" if "Issue" in df.columns
        else None
    )

    if "Model" not in df.columns:

        # No per-row cost basis available; fall back to a flat
        # default cost applied uniformly, same as before.
        total_cost = len(df) * default_cost

        if failure_column is None:
            return {
                "total_cost": total_cost,
                "by_mode": pd.DataFrame(),
                "by_model": pd.DataFrame(),
            }

        by_mode = (
            df[failure_column]
            .dropna()
            .astype(str)
            .value_counts()
            .reset_index()
        )

        by_mode.columns = [failure_column, "Count"]
        by_mode["Cost"] = by_mode["Count"] * default_cost
        by_mode = by_mode.sort_values(
            "Cost", ascending=False
        ).reset_index(drop=True)

        return {
            "total_cost": total_cost,
            "by_mode": by_mode,
            "by_model": pd.DataFrame(),
        }

    working = df.copy()

    working["_row_cost"] = (
        working["Model"]
        .map(cost_per_model)
        .fillna(default_cost)
    )

    total_cost = working["_row_cost"].sum()

    # ----- by failure mode -----
    if failure_column is not None:

        by_mode = (
            working
            .dropna(subset=[failure_column])
            .assign(**{
                failure_column: (
                    working[failure_column].astype(str)
                )
            })
            .groupby(failure_column)
            .agg(
                Count=("_row_cost", "count"),
                Cost=("_row_cost", "sum"),
            )
            .reset_index()
            .sort_values("Cost", ascending=False)
            .reset_index(drop=True)
        )

    else:
        by_mode = pd.DataFrame()

    # ----- by model -----
    by_model = (
        working
        .dropna(subset=["Model"])
        .assign(Model=working["Model"].astype(str))
        .groupby("Model")
        .agg(
            Count=("_row_cost", "count"),
            Cost=("_row_cost", "sum"),
        )
        .reset_index()
        .sort_values("Cost", ascending=False)
        .reset_index(drop=True)
    )

    return {
        "total_cost": total_cost,
        "by_mode": by_mode,
        "by_model": by_model,
    }


def get_blast_radius(df: pd.DataFrame, fleet_sizes: dict) -> pd.DataFrame:
    """
    Estimate future failure risk per product model, given an
    estimated fleet size (total units in the field) for each model.

    fleet_sizes: dict mapping Model -> estimated total units shipped.

    Returns a DataFrame with columns:
      Model, Failures, Fleet Size, Failure Rate, Units at Risk,
      Projected Additional Failures
    sorted by Projected Additional Failures descending.
    """

    if df is None or df.empty or "Model" not in df.columns:
        return pd.DataFrame()

    counts = (
        df["Model"]
        .dropna()
        .astype(str)
        .value_counts()
        .reset_index()
    )

    counts.columns = ["Model", "Failures"]

    rows = []

    for _, row in counts.iterrows():

        model = row["Model"]
        failures = row["Failures"]
        fleet_size = fleet_sizes.get(model, 0)

        if fleet_size <= 0:
            continue

        failure_rate = failures / fleet_size
        units_at_risk = max(fleet_size - failures, 0)
        projected = units_at_risk * failure_rate

        rows.append(
            {
                "Model": model,
                "Failures": int(failures),
                "Fleet Size": int(fleet_size),
                "Failure Rate": f"{failure_rate * 100:.1f}%",
                "Units at Risk": int(units_at_risk),
                "Projected Additional Failures": round(projected, 1),
            }
        )

    result = pd.DataFrame(rows)

    if not result.empty:
        result = result.sort_values(
            "Projected Additional Failures",
            ascending=False,
        ).reset_index(drop=True)

    return result


def get_missing_canonical_columns(df: pd.DataFrame) -> list:
    """
    Return the list of canonical columns that are missing from
    an already-normalized dataframe. Useful for validation
    messages on the Upload page.
    """

    if df is None:
        return list(COLUMN_ALIASES.keys())

    return [
        column
        for column in COLUMN_ALIASES
        if column not in df.columns
    ]
