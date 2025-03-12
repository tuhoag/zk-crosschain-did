import logging
import os
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import matplotlib.lines as mlines

logger = logging.getLogger(__name__)


def save_figure(figure, path):
    if not os.path.exists(os.path.dirname(path)):
        os.makedirs(os.path.dirname(path))

    print("saving figure to: {}".format(path))
    figure.savefig(path, bbox_inches='tight')

def visualize_line_chart_sb(df: pd.DataFrame, x_name: str, y_name: str, hue_cat_name: str, style_cat_name: str, fig_name: str, get_title: callable, options: dict = {}):
    x_values = df[x_name].unique()
    cat_values = df[hue_cat_name].unique()
    hue_cat_values = df[hue_cat_name].unique()
    style_cat_values = df[style_cat_name].unique()

    logger.debug("x: {} - values: {}".format(x_name, x_values))
    logger.debug("cat: {} - values: {}".format(hue_cat_name, cat_values))

    # sns.set_palette("pastel")
    custom_palette = sns.color_palette("bright", len(hue_cat_name))
    sns.set_palette(custom_palette)
    # sns.palplot(custom_palette)
    figure = sns.lineplot(
        data=df,
        y=y_name,
        x=x_name,
        hue=hue_cat_name,
        style=style_cat_name,
        palette=custom_palette,
        markers=True,
        markersize=options.get("markersize")).get_figure()

    # legend_handles = []

    # if style_cat_name == hue_cat_name:
    #     legend_handles.append(mlines.Line2D([0], [0], linestyle="none", marker="", label=get_title(style_cat_name)))
    #     for il, style_cat_value in enumerate(style_cat_values):
    #         handle = mlines.Line2D([], [], linestyle=dash_styles[il], color=colors[il], marker=marker_styles[il], label=style_cat_value)
    #         legend_handles.append(handle)
    # else:
    #     legend_handles.append(mlines.Line2D([0], [0], linestyle="none", marker="", label=get_title(hue_cat_name)))
    #     for im, heu_cat_value in enumerate(hue_cat_values):
    #         handle = mlines.Line2D([], [], color=colors[im], marker=marker_styles[im], label=heu_cat_value)
    #         legend_handles.append(handle)


    #     legend_handles.append(mlines.Line2D([0], [0], linestyle="none", marker="", label=get_title(style_cat_name)))
    #     for il, style_cat_value in enumerate(style_cat_values):
    #         handle = mlines.Line2D([], [], linestyle=dash_styles[il], color=colors[0], label=style_cat_value)
    #         legend_handles.append(handle)


    plt.ylabel(get_title(y_name), fontsize=options.get("fontsize"))
    plt.xlabel(get_title(x_name), fontsize=options.get("fontsize"))
    plt.grid(linestyle="--", axis="y", color="grey", linewidth=0.5)
    plt.xticks(x_values, fontsize=options.get("fontsize"))
    plt.yticks(fontsize=options.get("fontsize"))
    plt.legend(fontsize=options.get("legendsize"), title_fontsize=options.get("fontsize"))


    if fig_name is not None:
        path = "./images/{}.pdf".format(fig_name)
        save_figure(figure, path)

    plt.show()

def visualize_line_chart(df: pd.DataFrame, x_name: str, y_name: str, hue_cat_name: str, style_cat_name: str, fig_name: str, get_title: callable, options: dict = {}):
    x_values = df[x_name].unique()
    hue_cat_values = df[hue_cat_name].unique()
    style_cat_values = df[style_cat_name].unique()

    palette = sns.color_palette("bright", len(hue_cat_values))

    marker_styles = ["o", "s", "D", "^", "v", "p"]
    dash_styles = ["-", ":", "--", "-." ]
    colors = palette

    fig, ax = plt.subplots()
    for im, hue_cat_value in enumerate(hue_cat_values):
        for il, style_cat_value in enumerate(style_cat_values):
            cur_df = df[(df[hue_cat_name] == hue_cat_value) & (df[style_cat_name] == style_cat_value)]
            logger.info("plotting: {} {} {} {} {}".format(hue_cat_name, hue_cat_value, style_cat_name, style_cat_value, cur_df))
            ax.plot(cur_df[x_name], cur_df[y_name], marker=marker_styles[im], linestyle=dash_styles[il], color=colors[im], linewidth=options.get("linewidth"), markersize=options.get("markersize"))

    legend_handles = []

    if style_cat_name == hue_cat_name:
        legend_handles.append(mlines.Line2D([0], [0], linestyle="none", marker="", label=get_title(style_cat_name)))
        for il, style_cat_value in enumerate(style_cat_values):
            handle = mlines.Line2D([], [], linestyle=dash_styles[il], color=colors[il], marker=marker_styles[il], label=style_cat_value)
            legend_handles.append(handle)
    else:
        legend_handles.append(mlines.Line2D([0], [0], linestyle="none", marker="", label=get_title(hue_cat_name)))
        for im, heu_cat_value in enumerate(hue_cat_values):
            handle = mlines.Line2D([], [], color=colors[im], marker=marker_styles[im], label=heu_cat_value)
            legend_handles.append(handle)


        legend_handles.append(mlines.Line2D([0], [0], linestyle="none", marker="", label=get_title(style_cat_name)))
        for il, style_cat_value in enumerate(style_cat_values):
            handle = mlines.Line2D([], [], linestyle=dash_styles[il], color=colors[0], label=style_cat_value)
            legend_handles.append(handle)

    plt.legend(handles=legend_handles, title_fontsize=options.get("fontsize"), fontsize=options.get("legendsize"))
    plt.ylabel(get_title(y_name), fontsize=options.get("fontsize"))
    plt.xlabel(get_title(x_name), fontsize=options.get("fontsize"))
    plt.xticks(x_values, fontsize=options.get("fontsize"))
    plt.yticks(fontsize=options.get("fontsize"))
    plt.grid(linestyle="--", axis="y", color="grey", linewidth=0.5)
    # plt.title(fig_name)
    # fig.suptitle(fig_name)

    save_figure(fig, "./images/{}.pdf".format(fig_name))

    # if display:
    plt.show()
