extends PanelContainer

signal action_selected(action_id: String)
signal send_decision_requested(message_id: String, action_id: String, override_text: String)
signal snooze_requested(message_id: String, duration_minutes: int)
signal delegate_requested(message_id: String, target_character_id: String)
signal turn_into_rule_requested(message_id: String)
signal close_requested

const PILL_TAG_SCENE = preload("res://scenes/shared/PillTag.tscn")

@onready var sender_label: Label = $Margin/VBox/Header/TitleBox/Sender
@onready var subject_label: Label = $Margin/VBox/Header/TitleBox/Subject
@onready var priority_tag: PillTag = $Margin/VBox/Header/PriorityTag
@onready var close_button: Button = $Margin/VBox/Header/CloseButton
@onready var body_label: Label = $Margin/VBox/Body
@onready var consequence_list: VBoxContainer = $Margin/VBox/Consequences/Rows
@onready var action_row: ActionButtonRow = $Margin/VBox/DecisionSection/ActionRow
@onready var selected_action_label: Label = $Margin/VBox/DecisionSection/SelectedAction
@onready var override_input: LineEdit = $Margin/VBox/DecisionSection/OverrideInput
@onready var delegate_option: OptionButton = $Margin/VBox/DecisionSection/DelegateRow/DelegateTarget
@onready var delegate_button: Button = $Margin/VBox/DecisionSection/DelegateRow/DelegateButton
@onready var send_button: Button = $Margin/VBox/Footer/SendDecisionButton
@onready var snooze_button: Button = $Margin/VBox/Footer/SnoozeButton
@onready var turn_rule_button: Button = $Margin/VBox/Footer/TurnRuleButton
@onready var empty_label: Label = $Margin/VBox/EmptyState

var _message: Dictionary = {}
var _selected_action_id := ""

func _ready() -> void:
    action_row.action_pressed.connect(_on_action_pressed)
    send_button.pressed.connect(_on_send_pressed)
    snooze_button.pressed.connect(_on_snooze_pressed)
    delegate_button.pressed.connect(_on_delegate_pressed)
    turn_rule_button.pressed.connect(_on_turn_rule_pressed)
    close_button.pressed.connect(func() -> void:
        close_requested.emit()
    )
    _set_placeholder()

func set_message(message: Dictionary, characters: Array, selected_action_id: String = "") -> void:
    _message = message.duplicate(true)

    if message.is_empty():
        _set_placeholder()
        return

    empty_label.visible = false
    sender_label.text = str(message.get("senderName", "Unknown"))
    subject_label.text = str(message.get("subject", "Inbox item"))
    priority_tag.set_tag(str(message.get("priority", "low")).to_upper(), str(message.get("priority", "low")))
    body_label.text = str(message.get("body", ""))
    override_input.text = ""
    override_input.placeholder_text = "Short override or clarification"

    _populate_consequences(message.get("consequences", {}))
    _populate_delegate_targets(characters, str(message.get("characterId", "")))

    var actions: Array = message.get("suggestedActions", [])
    var active_action_id := selected_action_id
    if active_action_id.is_empty() and actions.size() > 0:
        active_action_id = str(actions[0].get("id", ""))

    action_row.set_actions(actions, active_action_id, false, true)
    _set_selected_action_label(actions, active_action_id)

    body_label.visible = true
    send_button.disabled = active_action_id.is_empty()
    snooze_button.disabled = false
    delegate_button.disabled = delegate_option.item_count == 0
    turn_rule_button.disabled = false

func _set_placeholder() -> void:
    _message = {}
    _selected_action_id = ""
    sender_label.text = "Selected Message"
    subject_label.text = "Choose an inbox item"
    priority_tag.set_tag("IDLE", "low")
    body_label.text = ""
    body_label.visible = false
    empty_label.visible = true
    empty_label.text = "Select an attention thread to inspect options, consequences, and rule hooks."
    selected_action_label.text = "No pending decision"
    override_input.text = ""
    send_button.disabled = true
    snooze_button.disabled = true
    delegate_button.disabled = true
    turn_rule_button.disabled = true
    for child in consequence_list.get_children():
        child.queue_free()
    delegate_option.clear()

func _populate_consequences(consequences: Dictionary) -> void:
    for child in consequence_list.get_children():
        child.queue_free()

    if consequences.is_empty():
        var placeholder := Label.new()
        placeholder.text = "No explicit consequence forecast yet."
        consequence_list.add_child(placeholder)
        return

    for key in consequences.keys():
        var row := HBoxContainer.new()
        row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
        var label := Label.new()
        label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
        label.text = "%s" % str(key).capitalize()
        var tag = PILL_TAG_SCENE.instantiate()
        row.add_child(label)
        row.add_child(tag)
        tag.set_tag(str(consequences[key]).to_upper(), str(key))
        consequence_list.add_child(row)

func _populate_delegate_targets(characters: Array, origin_character_id: String) -> void:
    delegate_option.clear()
    for character in characters:
        if not (character is Dictionary):
            continue
        if str(character.get("id", "")) == origin_character_id:
            continue
        delegate_option.add_item(str(character.get("name", "Character")))
        delegate_option.set_item_metadata(delegate_option.item_count - 1, str(character.get("id", "")))

func _set_selected_action_label(actions: Array, selected_action_id: String) -> void:
    _selected_action_id = selected_action_id
    for action in actions:
        if action is Dictionary and str(action.get("id", "")) == selected_action_id:
            selected_action_label.text = "Pending decision: %s" % str(action.get("label", ""))
            action_selected.emit(selected_action_id)
            return
    selected_action_label.text = "Pending decision: none"

func _on_action_pressed(action_id: String) -> void:
    _set_selected_action_label(_message.get("suggestedActions", []), action_id)
    send_button.disabled = action_id.is_empty()

func _on_send_pressed() -> void:
    var action_id := _current_action_id()
    if action_id.is_empty():
        return
    send_decision_requested.emit(str(_message.get("id", "")), action_id, override_input.text)

func _on_snooze_pressed() -> void:
    snooze_requested.emit(str(_message.get("id", "")), 30)

func _on_delegate_pressed() -> void:
    if delegate_option.item_count == 0:
        return
    var selected_target := str(delegate_option.get_item_metadata(delegate_option.selected))
    delegate_requested.emit(str(_message.get("id", "")), selected_target)

func _on_turn_rule_pressed() -> void:
    turn_into_rule_requested.emit(str(_message.get("id", "")))

func _current_action_id() -> String:
    return _selected_action_id
