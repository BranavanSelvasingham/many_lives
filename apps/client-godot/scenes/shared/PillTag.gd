class_name PillTag
extends PanelContainer

@onready var label: Label = $Label

func _ready() -> void:
    mouse_filter = Control.MOUSE_FILTER_IGNORE

func set_tag(text: String, tone: String = "normal") -> void:
    var target_label: Label = label
    if target_label == null:
        target_label = get_node_or_null("Label") as Label
    if target_label == null:
        return

    target_label.text = text
    add_theme_stylebox_override("panel", ThemeFactory.pill_style(tone))
    target_label.add_theme_color_override("font_color", ThemeFactory.text_color_for_tone(tone))
