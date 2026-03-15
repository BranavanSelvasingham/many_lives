extends Control

@onready var character_panel = $RootMargin/AppLayout/MainSplit/CharacterColumn
@onready var inbox_panel = $RootMargin/AppLayout/MainSplit/InboxColumn
@onready var message_detail_panel = $RootMargin/AppLayout/MainSplit/ContextColumn/MessageDetailPanel
@onready var policy_panel = $RootMargin/AppLayout/MainSplit/ContextColumn/PolicyPanel
@onready var timeline_panel = $RootMargin/AppLayout/TimelinePanel
@onready var http_request: HTTPRequest = $HttpRequest

var api := GameApi.new()
var game_state := GameState.new()
var selection_state := SelectionState.new()

func _ready() -> void:
    theme = ThemeFactory.build_dashboard_theme()
    character_panel.character_selected.connect(select_character)
    inbox_panel.message_selected.connect(select_message)
    inbox_panel.message_action_requested.connect(_on_inline_message_action)
    inbox_panel.filter_changed.connect(_on_filter_changed)
    message_detail_panel.action_selected.connect(_on_detail_action_selected)
    message_detail_panel.send_decision_requested.connect(resolve_message)
    message_detail_panel.snooze_requested.connect(snooze_message)
    message_detail_panel.delegate_requested.connect(delegate_message)
    message_detail_panel.turn_into_rule_requested.connect(_on_turn_into_rule_requested)
    message_detail_panel.close_requested.connect(_on_close_message_requested)
    policy_panel.policy_draft_changed.connect(_on_policy_draft_changed)
    policy_panel.policy_save_requested.connect(update_policy)
    policy_panel.close_rule_requested.connect(_on_close_rule_requested)
    timeline_panel.new_game_requested.connect(create_new_game)
    timeline_panel.tick_requested.connect(tick_game)
    _render()
    call_deferred("create_new_game")

func create_new_game() -> void:
    _set_busy(true)
    var result := await api.create_new_game(http_request)
    _set_busy(false)
    selection_state.context_mode = "auto"
    _ingest_response(result)

func tick_game(minutes: int) -> void:
    if game_state.game_id.is_empty():
        game_state.set_error("Create a game before advancing time.")
        _render()
        return

    _set_busy(true)
    var result := await api.tick_game(http_request, game_state.game_id, minutes)
    _set_busy(false)
    _ingest_response(result)

func select_character(character_id: String) -> void:
    selection_state.select_character(character_id)
    _render()

func select_message(message_id: String) -> void:
    var message := game_state.get_message(message_id)
    selection_state.select_message(message_id, str(message.get("characterId", "")))
    _render()

func resolve_message(message_id: String, action_id: String, override_text: String = "") -> void:
    if game_state.game_id.is_empty():
        return

    _set_busy(true)
    var result := await api.resolve_message(
        http_request,
        game_state.game_id,
        message_id,
        action_id,
        override_text,
    )
    _set_busy(false)
    selection_state.after_message_action()
    _ingest_response(result)

func snooze_message(message_id: String, duration_minutes: int) -> void:
    if game_state.game_id.is_empty():
        return

    _set_busy(true)
    var result := await api.snooze_message(
        http_request,
        game_state.game_id,
        message_id,
        duration_minutes,
    )
    _set_busy(false)
    selection_state.after_message_action()
    _ingest_response(result)

func delegate_message(message_id: String, target_character_id: String) -> void:
    if game_state.game_id.is_empty():
        return

    _set_busy(true)
    var result := await api.delegate_message(
        http_request,
        game_state.game_id,
        message_id,
        target_character_id,
    )
    _set_busy(false)
    selection_state.after_message_action()
    _ingest_response(result)

func update_policy(character_id: String, policy_patch: Dictionary, draft: Dictionary) -> void:
    game_state.apply_local_policy(character_id, draft)
    _render()

    if game_state.game_id.is_empty():
        return

    _set_busy(true)
    var result := await api.update_policy(
        http_request,
        game_state.game_id,
        character_id,
        policy_patch,
    )
    _set_busy(false)
    _ingest_response(result)

func _ingest_response(result: Dictionary) -> void:
    if result.is_empty():
        _render()
        return

    if result.has("game"):
        game_state.set_world_state(result.get("game", {}), str(result.get("source", api.source_mode)))
        if result.has("error") and not str(result.get("error", "")).is_empty():
            game_state.set_error(str(result.get("error", "")))
        else:
            game_state.clear_error()
    elif result.has("error"):
        game_state.set_error(str(result.get("error", "")))

    selection_state.sync(game_state.world_state)
    _render()

func _on_inline_message_action(message_id: String, action_id: String) -> void:
    await resolve_message(message_id, action_id)

func _on_filter_changed(filter_name: String) -> void:
    selection_state.set_inbox_filter(filter_name)
    if selection_state.context_mode == "message":
        var visible_messages := game_state.visible_messages(filter_name)
        var still_visible := false
        for message in visible_messages:
            if message is Dictionary and str(message.get("id", "")) == selection_state.selected_message_id:
                still_visible = true
                break
        if not still_visible:
            selection_state.after_message_action()
    _render()

func _on_detail_action_selected(action_id: String) -> void:
    selection_state.set_selected_action(action_id)

func _on_turn_into_rule_requested(message_id: String) -> void:
    var message := game_state.get_message(message_id)
    if message.is_empty():
        return
    selection_state.begin_rule_mode(message)
    _render()

func _on_close_message_requested() -> void:
    selection_state.clear_message_selection()
    _render()

func _on_close_rule_requested() -> void:
    selection_state.end_rule_mode()
    _render()

func _on_policy_draft_changed(character_id: String, draft: Dictionary) -> void:
    game_state.apply_local_policy(character_id, draft)
    _render()

func _set_busy(is_busy: bool) -> void:
    game_state.busy = is_busy
    timeline_panel.set_busy(is_busy)

func _render() -> void:
    selection_state.sync(game_state.world_state)

    var all_characters: Array = game_state.world_state.get("characters", [])
    var visible_messages := game_state.visible_messages(selection_state.inbox_filter)
    var selected_character := game_state.get_character(selection_state.selected_character_id)
    var selected_message := game_state.get_message(selection_state.selected_message_id)

    character_panel.set_characters(all_characters, selection_state.selected_character_id)
    inbox_panel.set_messages(visible_messages, selection_state.selected_message_id, selection_state.inbox_filter)
    timeline_panel.set_world_state(game_state.world_state, game_state.last_error, api.describe_source())

    if selection_state.context_mode == "message" and not selected_message.is_empty():
        message_detail_panel.show()
        policy_panel.hide()
        message_detail_panel.set_message(selected_message, all_characters, selection_state.selected_action_id)
    else:
        message_detail_panel.hide()
        policy_panel.show()
        policy_panel.set_character(selected_character, selection_state.rule_context)
