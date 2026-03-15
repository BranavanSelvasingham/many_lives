class_name GameState
extends RefCounted

var world_state: Dictionary = {}
var raw_world_state: Dictionary = {}
var game_id := ""
var busy := false
var last_error := ""
var source_mode := "backend"

func set_world_state(next_world_state: Dictionary, next_source_mode: String = "backend") -> void:
    raw_world_state = next_world_state.duplicate(true)
    world_state = WorldStateModel.normalize(next_world_state)
    game_id = str(world_state.get("gameId", ""))
    source_mode = next_source_mode

func set_error(error_text: String) -> void:
    last_error = error_text

func clear_error() -> void:
    last_error = ""

func apply_local_policy(character_id: String, draft: Dictionary) -> void:
    for character in world_state.get("characters", []):
        if character is Dictionary and str(character.get("id", "")) == character_id:
            character["policy"] = draft.duplicate(true)
            character["autonomyProfile"] = PolicyModel.describe_autonomy_profile(draft)
            break

    world_state["worldSummary"] = WorldStateModel.rebuild_world_summary(world_state)

func get_character(character_id: String) -> Dictionary:
    for character in world_state.get("characters", []):
        if character is Dictionary and str(character.get("id", "")) == character_id:
            return character
    return {}

func get_message(message_id: String) -> Dictionary:
    for message in world_state.get("inbox", []):
        if message is Dictionary and str(message.get("id", "")) == message_id:
            return message
    return {}

func visible_messages(filter_name: String) -> Array:
    return InboxMessageModel.filter_messages(
        world_state.get("inbox", []),
        filter_name,
        str(world_state.get("currentTimeIso", "")),
    )
