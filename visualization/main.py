import argparse
import os
import pandas as pd
import logging
from utils import visualization as vutils
from utils.args import setup_arguments, setup_console_logging

logger = logging.getLogger(__name__)

DATA_DIR = "./data"

def add_arguments(parser: argparse.ArgumentParser):
    parser.add_argument("--exp")


def get_transition_verification_exp_data_path(exp_name: str) -> str:
    return os.path.join(DATA_DIR, "onchain-status_fulfillment.csv")

def get_all_exp_data_path() -> str:
    return os.path.join(DATA_DIR, "alldata.csv")

def load_exp_data(exp_name):
    path = get_all_exp_data_path()
    # print(path)
    return pd.read_csv(path)
    # if exp_name == "transition_verification":
    #     return pd.read_csv(get_transition_verification_exp_data_path(exp_name))

def visualize_transition_verification_cost(df):
    df = df[(df["mechanism"].isin(["cbsl", "smt"]))
            & (df["num_states"].isin([5, 10, 15, 20]))
            & (df["num_credentials"].isin([16384]))]
    x_name = "num_states"
    y_name = "update_cost (kgas)"
    hue_cat_name = "Mechanism"
    style_cat_name = "Algorithm"

    df = df.sort_values(by=[x_name, hue_cat_name])
    df = df.sort_values(by=[style_cat_name], ascending=False)

    options = {
        "fontsize": 13,
        "legendsize": 11
    }
    vutils.visualize_line_chart(
        df=df,
        x_name=x_name,
        y_name=y_name,
        hue_cat_name=hue_cat_name,
        style_cat_name=style_cat_name,
        fig_name="mechanism_states_cost",
        get_title=get_title,
        options=options
    )

def visualize_transition_vs_oracles(df):
    df = df[(df["mechanism"].isin(["cbsl", "smt"]))
            & (df["num_states"].isin([5]))
            & (df["num_credentials"].isin([16384]))
            & (df["num_oracles"] != 0)]
    x_name = "num_oracles"
    y_name = "update_cost (kgas)"
    hue_cat_name = "Mechanism"
    style_cat_name = "Algorithm"

    df = df.sort_values(by=[x_name, hue_cat_name])
    df = df.sort_values(by=[style_cat_name], ascending=False)
    logger.info(len(df))
    logger.info(df[[x_name, hue_cat_name, style_cat_name, y_name]])

    options = {
        "fontsize": 13,
        "legendsize": 11,
        "markersize": 8,
        "linewidth": 1
    }
    vutils.visualize_line_chart(
        df=df,
        x_name=x_name,
        y_name=y_name,
        hue_cat_name=hue_cat_name,
        style_cat_name=style_cat_name,
        fig_name="mechanism_oracles_cost",
        get_title=get_title,
        options=options
    )

def visualize_proving_time_states(df):
    df = df[(df["mechanism"].isin(["cbsl", "smt"]))
            & (df["num_states"].isin([5, 10, 15, 20]))
            & (df["num_credentials"].isin([16384]))
            & (df["algorithm"].isin(["zkCrossChainSSI"]))
            # & (df["num_oracles"].isin([4]))
            ]

    x_name = "Number of Oracles"
    y_name = "proving_time (s)"
    hue_cat_name = "Number of States"
    style_cat_name = "Mechanism"

    df = df.sort_values(by=[x_name, hue_cat_name])
    df = df.sort_values(by=[style_cat_name], ascending=False)
    logger.info(len(df))
    logger.info(df[[x_name, hue_cat_name, style_cat_name, y_name]])
    options = {
        "fontsize": 13,
        "legendsize": 11,
        "markersize": 8,
        "linewidth": 1
    }
    vutils.visualize_line_chart(
        df=df,
        x_name=x_name,
        y_name=y_name,
        hue_cat_name=hue_cat_name,
        style_cat_name=style_cat_name,
        fig_name="transition_proving_time",
        get_title=get_title,
        options=options
    )

def get_title(name: str) -> str:
    name2title = {
        "num_states": "Number of States",
        "num_credentials": "Number of Credentials",
        "mechanism": "Mechanism",
        "algorithm": "Algorithm",
        "update_cost (gas)": "Update Cost (gas)",
        "update_cost (kgas)": "Update Cost (kGas)",
        "mechanism_visual": "Mechanism",
        "num_oracles": "Number of Oracles",
    }

    if name in name2title:
        return name2title[name]

    return name

def visualize(exp_name: str, df: pd.DataFrame):
    if exp_name == "states_cost":
        visualize_transition_verification_cost(df)
    elif exp_name == "oracles_cost":
        visualize_transition_vs_oracles(df)
    elif exp_name == "states_proving_time":
        visualize_proving_time_states(df)
    else:
        logger.error("Unknown exp_name: {}".format(exp_name))

def add_additional_info(df: pd.DataFrame):
    df["update_cost (kgas)"] =  df["update_cost (gas)"] / 1000
    df["Mechanism"] = df["mechanism"].map(lambda x: "BSL" if x == "cbsl" else "SMT")
    df["Algorithm"] = df["algorithm"]
    df["Number of Oracles"] = df["num_oracles"]
    df["Number of States"] = df["num_states"]

def rename_columns(df):
    df = df.rename(columns={
        "num_states": "Number of States",
        "num_credentials": "Number of Credentials",
        "mechanism": "Mechanism",
        "algorithm": "Algorithm",
        "update_cost (gas)": "Update Cost (gas)",
        "update_cost (kgas)": "Update Cost (kGas)",
        "mechanism_visual": "Mechanism",
        "num_oracles": "Number of Oracles",
    })
    return df

def main(args: dict):
    exp_name = args["exp"]

    df = load_exp_data(exp_name)

    add_additional_info(df)
    # print(df)
    # df = rename_columns(df)
    visualize(exp_name, df)

if __name__ == "__main__":
    args = setup_arguments(add_arguments)
    setup_console_logging(args)
    main(args)