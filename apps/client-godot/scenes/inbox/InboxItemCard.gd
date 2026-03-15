extends PanelContainer

signal selected(message_id: String)
signal action_requested(message_id: String, action_id: String)

@onready var sender_label: Label = $Margin/VBox/TopRow/Identity
@onready var priority_tag: PillTag = $Margin/VBox/TopRow/PriorityTag
@onready var time_label: Label = $Margin/VBox/TopRow/Time
@onready var subject_label: Label = $Margin/VBox/Subject
@onready var preview_label: Label = $Margin/VBox/Preview
@onready var requires_label: Label = $Margin/VBox/MetaRow/RequiresLabel
@onready var type_label: Label = $Margin/VBox/MetaRow/TypeLabel
@onready var action_row: ActionButtonRow = $Margin/VBox/ActionRow

var _message_id := ""

func _ready() -> void:
    mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
    action_row.action_pressed.connect(_on_action_pressed)

func set_message(message: Dictionary, is_selected: bool) -> void:
    _message_id = str(message.get("id", ""))
    sender_label.text = str(message.get("senderName", "Unknown"))
    priority_tag.set_tag(str(message.get("priority", "low")).to_upper(), str(message.get("priority", "low")))
    time_label.text = str(message.get("createdAt", ""))
    subject_label.text = str(message.get("subject", "Inbox item"))
    preview_label.text = str(message.get("preview", ""))
    type_label.text = str(message.get("type", "status")).to_upper()
    requires_label.visible = bool(message.get("requiresResponse", false))
    requires_label.text = "Needs response" if requires_label.visible else ""
    add_theme_stylebox_override("panel", ThemeFactory.card_style(is_selected, "subtle"))

    var inline_actions: Array = []
    for action in message.get("suggestedActions", []):
        inline_actions.append(action)
        if inline_actions.size() >= 3:
            break
    action_row.set_actions(inline_actions, "", true, false)

func _gui_input(event: InputEvent) -> void:
    if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
        selected.emit(_message_id)

func _on_action_pressed(action_id: String) -> void:
    action_requested.emit(_message_id, action_id)
