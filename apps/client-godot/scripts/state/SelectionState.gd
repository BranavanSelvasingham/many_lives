class_name SelectionState
extends RefCounted

var selected_character_id := ""
var selected_message_id := ""
var selected_action_id := ""
var inbox_filter := "All"
var context_mode := "auto"
var rule_context: Dictionary = {}

func select_character(character_id: String) -> void:
    selected_character_id = character_id
    selected_message_id = ""
    selected_action_id = ""
    context_mode = "character"
    rule_context = {}

func select_message(message_id: String, character_id: String) -> void:
    selected_message_id = message_id
    selected_character_id = character_id
    selected_action_id = ""
    context_mode = "message"
    rule_context = {}

func set_inbox_filter(filter_name: String) -> void:
    inbox_filter = filter_name

func set_selected_action(action_id: String) -> void:
    selected_action_id = action_id

func clear_message_selection() -> void:
    selected_message_id = ""
    selected_action_id = ""
    context_mode = "character"
    rule_context = {}

func after_message_action() -> void:
    selected_message_id = ""
    selected_action_id = ""
    context_mode = "auto"
    rule_context = {}

func begin_rule_mode(message: Dictionary) -> void:
    selected_message_id = str(message.get("id", ""))
    selected_character_id = str(message.get("characterId", selected_character_id))
    context_mode = "rule"
    rule_context = {
        "messageId": str(message.get("id", "")),
        "subject": str(message.get("subject", "Rule draft")),
        "body": str(message.get("body", "")),
        "consequences": message.get("consequences", {}).duplicate(true),
    }

func end_rule_mode() -> void:
    context_mode = "character"
    rule_context = {}

func sync(world_state: Dictionary) -> void:
    var characters: Array = world_state.get("characters", [])
    var messages: Array = InboxMessageModel.filter_messages(
        world_state.get("inbox", []),
        "All",
        str(world_state.get("currentTimeIso", "")),
    )

    if not _character_exists(characters, selected_character_id):
        selected_character_id = ""

    if not _message_exists(messages, selected_message_id):
        selected_message_id = ""
        selected_action_id = ""
        if context_mode == "message":
            context_mode = "auto"

    if context_mode == "auto":
        if messages.size() > 0:
            var first_message: Dictionary = messages[0]
            selected_message_id = str(first_message.get("id", ""))
            selected_character_id = str(first_message.get("characterId", selected_character_id))
            context_mode = "message"
            return
        context_mode = "character"

    if selected_character_id.is_empty() and characters.size() > 0:
        selected_character_id = str(characters[0].get("id", ""))

func _character_exists(characters: Array, character_id: String) -> bool:
    for character in characters:
        if character is Dictionary and str(character.get("id", "")) == character_id:
            return true
    return false

func _message_exists(messages: Array, message_id: String) -> bool:
    for message in messages:
        if message is Dictionary and str(message.get("id", "")) == message_id:
            return true
    return false
