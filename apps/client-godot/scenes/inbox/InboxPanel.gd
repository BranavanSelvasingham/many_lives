extends PanelContainer

signal message_selected(message_id: String)
signal message_action_requested(message_id: String, action_id: String)
signal filter_changed(filter_name: String)

const INBOX_ITEM_SCENE = preload("res://scenes/inbox/InboxItemCard.tscn")

@onready var count_label: Label = $Margin/VBox/Header/Count
@onready var card_container: VBoxContainer = $Margin/VBox/Scroll/Content
@onready var empty_label: Label = $Margin/VBox/Scroll/Content/EmptyLabel
@onready var filter_buttons := {
    "All": $Margin/VBox/Filters/AllButton,
    "Urgent": $Margin/VBox/Filters/UrgentButton,
    "Waiting": $Margin/VBox/Filters/WaitingButton,
    "Reports": $Margin/VBox/Filters/ReportsButton,
    "Opportunities": $Margin/VBox/Filters/OpportunitiesButton,
}

func _ready() -> void:
    for filter_name in filter_buttons.keys():
        var button: Button = filter_buttons[filter_name]
        button.pressed.connect(_on_filter_pressed.bind(filter_name))

func set_messages(messages: Array, selected_message_id: String, active_filter: String) -> void:
    for child in card_container.get_children():
        if child != empty_label:
            child.queue_free()

    _set_active_filter(active_filter)
    empty_label.visible = messages.is_empty()
    count_label.text = "%d active threads" % messages.size()

    var waiting_count := 0
    for message in messages:
        if not (message is Dictionary):
            continue
        if bool(message.get("requiresResponse", false)):
            waiting_count += 1

        var card = INBOX_ITEM_SCENE.instantiate()
        card_container.add_child(card)
        card.selected.connect(_on_message_selected)
        card.action_requested.connect(_on_message_action_requested)
        card.set_message(message, str(message.get("id", "")) == selected_message_id)

    if messages.is_empty():
        empty_label.text = "Nothing matches the %s filter right now." % active_filter.to_lower()
    else:
        count_label.text = "%d active | %d waiting" % [messages.size(), waiting_count]

func _set_active_filter(active_filter: String) -> void:
    for filter_name in filter_buttons.keys():
        var button: Button = filter_buttons[filter_name]
        button.button_pressed = filter_name == active_filter

func _on_filter_pressed(filter_name: String) -> void:
    filter_changed.emit(filter_name)

func _on_message_selected(message_id: String) -> void:
    message_selected.emit(message_id)

func _on_message_action_requested(message_id: String, action_id: String) -> void:
    message_action_requested.emit(message_id, action_id)
