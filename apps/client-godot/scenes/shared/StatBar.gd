class_name StatBar
extends VBoxContainer

@onready var title_label: Label = $TopRow/Title
@onready var value_label: Label = $TopRow/Value
@onready var progress_bar: ProgressBar = $Bar

func _ready() -> void:
    progress_bar.show_percentage = false

func set_stat(title: String, value: float, tone: String = "normal") -> void:
    title_label.text = title
    value_label.text = "%d" % int(value)
    progress_bar.value = clamp(value, 0.0, 100.0)

    var fill := StyleBoxFlat.new()
    fill.bg_color = ThemeFactory.priority_color(tone)
    fill.corner_radius_top_left = 8
    fill.corner_radius_top_right = 8
    fill.corner_radius_bottom_right = 8
    fill.corner_radius_bottom_left = 8

    var background := StyleBoxFlat.new()
    background.bg_color = Color("12202b")
    background.corner_radius_top_left = 8
    background.corner_radius_top_right = 8
    background.corner_radius_bottom_right = 8
    background.corner_radius_bottom_left = 8

    progress_bar.add_theme_stylebox_override("fill", fill)
    progress_bar.add_theme_stylebox_override("background", background)
