extends PanelContainer

signal selected(character_id: String)

@onready var name_label: Label = $Margin/VBox/TopRow/NameBox/Name
@onready var role_label: Label = $Margin/VBox/TopRow/NameBox/Role
@onready var urgency_tag: PillTag = $Margin/VBox/TopRow/UrgencyTag
@onready var current_task_label: Label = $Margin/VBox/CurrentTask
@onready var next_obligation_label: Label = $Margin/VBox/NextObligation
@onready var stress_bar: StatBar = $Margin/VBox/StressBar

var _character_id := ""

func _ready() -> void:
    mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND

func set_character(character: Dictionary, is_selected: bool) -> void:
    _character_id = str(character.get("id", ""))
    name_label.text = str(character.get("name", "Unknown"))
    role_label.text = str(character.get("subtitle", "Life"))
    current_task_label.text = "Now: %s" % str(character.get("currentTask", "Waiting"))
    next_obligation_label.text = "Next: %s" % str(character.get("nextObligation", "No immediate obligation"))
    stress_bar.set_stat("Stress", float(character.get("stress", 0)), str(character.get("urgency", "low")))
    urgency_tag.set_tag(str(character.get("urgency", "low")).to_upper(), str(character.get("urgency", "low")))
    add_theme_stylebox_override("panel", ThemeFactory.card_style(is_selected, "raised"))

func _gui_input(event: InputEvent) -> void:
    if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
        selected.emit(_character_id)
