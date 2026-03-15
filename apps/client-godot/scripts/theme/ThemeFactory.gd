class_name ThemeFactory
extends RefCounted

static func build_dashboard_theme() -> Theme:
    var theme := Theme.new()

    theme.set_color("font_color", "Label", Color("e6edf4"))
    theme.set_color("font_color", "Button", Color("e6edf4"))
    theme.set_color("font_color", "LineEdit", Color("e6edf4"))
    theme.set_color("font_color", "TextEdit", Color("e6edf4"))

    theme.set_stylebox("panel", "PanelContainer", card_style(false, "panel"))
    theme.set_stylebox("normal", "Button", button_style(false))
    theme.set_stylebox("hover", "Button", button_style(true))
    theme.set_stylebox("pressed", "Button", button_style(true, true))
    theme.set_stylebox("focus", "Button", button_style(true))
    theme.set_stylebox("normal", "LineEdit", input_style())
    theme.set_stylebox("focus", "LineEdit", input_style(true))
    theme.set_stylebox("normal", "TextEdit", input_style())
    theme.set_stylebox("focus", "TextEdit", input_style(true))
    theme.set_stylebox("normal", "OptionButton", button_style(false))
    theme.set_stylebox("hover", "OptionButton", button_style(true))
    theme.set_stylebox("pressed", "OptionButton", button_style(true, true))

    return theme

static func card_style(selected: bool = false, emphasis: String = "panel") -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.bg_color = Color("1a2430")
    style.border_color = Color("2b3a4a")
    style.border_width_left = 1
    style.border_width_top = 1
    style.border_width_right = 1
    style.border_width_bottom = 1
    style.corner_radius_top_left = 10
    style.corner_radius_top_right = 10
    style.corner_radius_bottom_right = 10
    style.corner_radius_bottom_left = 10
    style.content_margin_left = 8
    style.content_margin_right = 8
    style.content_margin_top = 8
    style.content_margin_bottom = 8

    if emphasis == "subtle":
        style.bg_color = Color("141d27")
    elif emphasis == "raised":
        style.bg_color = Color("202d3a")

    if selected:
        style.bg_color = Color("213445")
        style.border_color = Color("6fc3df")

    return style

static func pill_style(tone: String) -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.corner_radius_top_left = 999
    style.corner_radius_top_right = 999
    style.corner_radius_bottom_right = 999
    style.corner_radius_bottom_left = 999
    style.content_margin_left = 8
    style.content_margin_right = 8
    style.content_margin_top = 3
    style.content_margin_bottom = 3
    style.bg_color = priority_color(tone).darkened(0.35)
    return style

static func button_style(hovered: bool, pressed: bool = false) -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.corner_radius_top_left = 8
    style.corner_radius_top_right = 8
    style.corner_radius_bottom_right = 8
    style.corner_radius_bottom_left = 8
    style.content_margin_left = 12
    style.content_margin_right = 12
    style.content_margin_top = 7
    style.content_margin_bottom = 7
    style.bg_color = Color("213445") if hovered else Color("1b2834")
    style.border_color = Color("6fc3df") if pressed else Color("304356")
    style.border_width_left = 1
    style.border_width_top = 1
    style.border_width_right = 1
    style.border_width_bottom = 1
    return style

static func input_style(focused: bool = false) -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.bg_color = Color("101820")
    style.border_color = Color("6fc3df") if focused else Color("2f4252")
    style.border_width_left = 1
    style.border_width_top = 1
    style.border_width_right = 1
    style.border_width_bottom = 1
    style.corner_radius_top_left = 8
    style.corner_radius_top_right = 8
    style.corner_radius_bottom_right = 8
    style.corner_radius_bottom_left = 8
    return style

static func priority_color(priority: String) -> Color:
    match priority:
        "urgent":
            return Color("ff7b7b")
        "high":
            return Color("ffb86b")
        "normal":
            return Color("7fb7ff")
        "low":
            return Color("8dd3a8")
        "money":
            return Color("f3cf72")
        "relationship":
            return Color("f39bc0")
        "health":
            return Color("86d0b2")
        "schedule":
            return Color("7fb7ff")
        _:
            return Color("5f7388")

static func text_color_for_tone(tone: String) -> Color:
    var color := priority_color(tone)
    return color.lightened(0.35)
