class_name GameApi
extends RefCounted

var base_url := ""
var source_mode := "backend"
var _mock_game_counter := 1
var _mock_world_state: Dictionary = {}

func _init(custom_base_url: String = "") -> void:
	if not custom_base_url.is_empty():
		base_url = custom_base_url
	else:
		base_url = OS.get_environment("MANY_LIVES_API_BASE_URL")

	if base_url.is_empty():
		base_url = "http://127.0.0.1:3000"

	base_url = base_url.rstrip("/")

func describe_source() -> String:
	if source_mode == "mock":
		return "Local mock data"
	return base_url

func create_new_game(http_request: HTTPRequest) -> Dictionary:
	return await _request_with_fallback(http_request, HTTPClient.METHOD_POST, "/game/new", {})

func fetch_game_state(http_request: HTTPRequest, game_id: String) -> Dictionary:
	return await _request_with_fallback(http_request, HTTPClient.METHOD_GET, "/game/%s/state" % game_id)

func tick_game(http_request: HTTPRequest, game_id: String, minutes: int) -> Dictionary:
	return await _request_with_fallback(
		http_request,
		HTTPClient.METHOD_POST,
		"/game/%s/tick" % game_id,
		{"minutes": minutes},
	)

func resolve_message(
	http_request: HTTPRequest,
	game_id: String,
	message_id: String,
	action_id: String,
	override_text: String = "",
) -> Dictionary:
	return await _request_with_fallback(
		http_request,
		HTTPClient.METHOD_POST,
		"/game/%s/command" % game_id,
		{
			"type": "resolve_inbox",
			"messageId": message_id,
			"actionId": action_id,
			"overrideText": override_text.strip_edges(),
		},
	)

func snooze_message(
	http_request: HTTPRequest,
	game_id: String,
	message_id: String,
	duration_minutes: int,
) -> Dictionary:
	return await _request_with_fallback(
		http_request,
		HTTPClient.METHOD_POST,
		"/game/%s/command" % game_id,
		{
			"type": "snooze_inbox",
			"messageId": message_id,
			"durationMinutes": duration_minutes,
		},
	)

func delegate_message(
	http_request: HTTPRequest,
	game_id: String,
	message_id: String,
	target_character_id: String,
) -> Dictionary:
	return await _request_with_fallback(
		http_request,
		HTTPClient.METHOD_POST,
		"/game/%s/command" % game_id,
		{
			"type": "delegate_inbox",
			"messageId": message_id,
			"targetCharacterId": target_character_id,
		},
	)

func update_policy(
	http_request: HTTPRequest,
	game_id: String,
	character_id: String,
	policy_patch: Dictionary,
) -> Dictionary:
	return await _request_with_fallback(
		http_request,
		HTTPClient.METHOD_POST,
		"/game/%s/policy" % game_id,
		{
			"characterId": character_id,
			"policy": policy_patch,
		},
	)

func _request_with_fallback(
	http_request: HTTPRequest,
	method: int,
	path: String,
	body: Dictionary = {},
) -> Dictionary:
	if source_mode == "mock":
		return _mock_response(path, body)

	var backend_response = await _request_backend(http_request, method, path, body)
	if backend_response.get("ok", false):
		source_mode = "backend"
		var payload = backend_response.get("payload", {})
		payload["source"] = "backend"
		return payload

	source_mode = "mock"
	var mock_response = _mock_response(path, body)
	mock_response["error"] = backend_response.get(
		"error",
		"Backend unavailable. Falling back to local mock data.",
	)
	return mock_response

func _request_backend(
	http_request: HTTPRequest,
	method: int,
	path: String,
	body: Dictionary = {},
) -> Dictionary:
	var headers := PackedStringArray()
	var payload := ""

	if method != HTTPClient.METHOD_GET:
		headers.append("Content-Type: application/json")
		payload = JSON.stringify(body)

	var start_error := http_request.request(base_url + path, headers, method, payload)
	if start_error != OK:
		return {
			"ok": false,
			"error": "Could not reach the simulation backend (%s)." % start_error,
		}

	var result: Array = await http_request.request_completed
	var request_result = int(result[0])
	var response_code = int(result[1])
	var response_body: PackedByteArray = result[3]
	var response_text = response_body.get_string_from_utf8()
	var parsed: Variant = {}

	if not response_text.is_empty():
		var maybe_parsed = JSON.parse_string(response_text)
		if maybe_parsed != null:
			parsed = maybe_parsed

	if request_result != HTTPRequest.RESULT_SUCCESS:
		return {
			"ok": false,
			"error": "The simulation backend did not respond cleanly. Using mock data instead.",
		}

	if response_code >= 400:
		if parsed is Dictionary and parsed.has("message"):
			return {"ok": false, "error": str(parsed["message"])}
		return {
			"ok": false,
			"error": "The backend returned HTTP %d." % response_code,
		}

	if parsed is Dictionary:
		return {"ok": true, "payload": parsed}

	return {
		"ok": false,
		"error": "The backend returned an unexpected payload. Using mock data instead.",
	}

func _mock_response(path: String, body: Dictionary) -> Dictionary:
	if path == "/game/new":
		var new_game_id = "mock-%d" % _mock_game_counter
		_mock_game_counter += 1
		_mock_world_state = WorldStateModel.build_mock_world(new_game_id)
		return {
			"game": _mock_world_state.duplicate(true),
			"source": "mock",
		}

	if _mock_world_state.is_empty():
		_mock_world_state = WorldStateModel.build_mock_world("mock-%d" % _mock_game_counter)

	if path.ends_with("/tick"):
		var minutes = int(body.get("minutes", 30))
		_mock_world_state = _tick_mock_world(_mock_world_state, minutes)
	elif path.ends_with("/command"):
		var command_type = str(body.get("type", ""))
		match command_type:
			"resolve_inbox":
				_mock_world_state = _resolve_mock_message(
					_mock_world_state,
					str(body.get("messageId", "")),
					str(body.get("actionId", "")),
					str(body.get("overrideText", "")),
				)
			"snooze_inbox":
				_mock_world_state = _snooze_mock_message(
					_mock_world_state,
					str(body.get("messageId", "")),
					int(body.get("durationMinutes", 30)),
				)
			"delegate_inbox":
				_mock_world_state = _delegate_mock_message(
					_mock_world_state,
					str(body.get("messageId", "")),
					str(body.get("targetCharacterId", "")),
				)
	elif path.ends_with("/policy"):
		_mock_world_state = _update_mock_policy(
			_mock_world_state,
			str(body.get("characterId", "")),
			body.get("policy", {}),
		)

	return {
		"game": _mock_world_state.duplicate(true),
		"source": "mock",
	}

func _tick_mock_world(world: Dictionary, minutes: int) -> Dictionary:
	var next_world = world.duplicate(true)
	var steps = maxi(1, int(round(float(minutes) / 30.0)))
	next_world["tickCount"] = int(next_world.get("tickCount", 0)) + steps
	next_world["currentTimeIso"] = WorldStateModel.add_minutes(
		str(next_world.get("currentTimeIso", "")),
		steps * 30,
	)
	next_world["time"] = WorldStateModel.format_time(str(next_world.get("currentTimeIso", "")))

	for character in next_world.get("characters", []):
		if character is Dictionary:
			character["stress"] = int(clamp(int(character.get("stress", 50)) + steps, 0, 100))
			character["energy"] = int(clamp(int(character.get("energy", 50)) - steps, 0, 100))
			character["load"] = int(clamp((int(character["stress"]) + (100 - int(character["energy"]))) / 2, 0, 100))

	_spawn_mock_followups(next_world)
	next_world["summary"] = WorldStateModel.build_mock_summary(next_world)
	next_world["worldSummary"] = WorldStateModel.rebuild_world_summary(next_world)
	return next_world

func _resolve_mock_message(
	world: Dictionary,
	message_id: String,
	action_id: String,
	override_text: String,
) -> Dictionary:
	var next_world = world.duplicate(true)
	var inbox: Array = next_world.get("inbox", [])
	var resolved_index = -1

	for index in range(inbox.size()):
		var message = inbox[index]
		if message is Dictionary and str(message.get("id", "")) == message_id:
			message["resolvedAt"] = str(next_world.get("currentTimeIso", ""))
			resolved_index = index
			break

	if resolved_index != -1:
		inbox.remove_at(resolved_index)

	var message_character_id = WorldStateModel.message_character_id(world, message_id)
	for character in next_world.get("characters", []):
		if character is Dictionary and str(character.get("id", "")) == message_character_id:
			character["stress"] = int(clamp(int(character.get("stress", 50)) - 5, 0, 100))

	next_world["summary"] = WorldStateModel.build_mock_summary(next_world, action_id, override_text)
	next_world["worldSummary"] = WorldStateModel.rebuild_world_summary(next_world)
	return next_world

func _snooze_mock_message(world: Dictionary, message_id: String, duration_minutes: int) -> Dictionary:
	var next_world = world.duplicate(true)
	for message in next_world.get("inbox", []):
		if message is Dictionary and str(message.get("id", "")) == message_id:
			message["snoozedUntil"] = WorldStateModel.add_minutes(
				str(next_world.get("currentTimeIso", "")),
				duration_minutes,
			)

	next_world["worldSummary"] = WorldStateModel.rebuild_world_summary(next_world)
	return next_world

func _delegate_mock_message(world: Dictionary, message_id: String, target_character_id: String) -> Dictionary:
	var next_world = _resolve_mock_message(world, message_id, "delegate", "")
	var target_name = WorldStateModel.character_name(next_world, target_character_id)

	if not target_name.is_empty():
		var delegated_message = {
			"id": "msg_delegate_%s_%d" % [target_character_id, int(next_world.get("tickCount", 0))],
			"characterId": target_character_id,
			"senderName": target_name,
			"type": "status",
			"priority": "normal",
			"subject": "Delegated Thread Accepted",
			"body": "%s will absorb the redirected work and report back after the next block." % target_name,
			"preview": "%s will absorb the redirected work and report back after the next block." % target_name,
			"createdAt": str(next_world.get("time", "")),
			"createdAtIso": str(next_world.get("currentTimeIso", "")),
			"requiresResponse": false,
			"suggestedActions": [
				{"id": "acknowledge", "label": "Acknowledge"},
			],
			"consequences": {
				"stress": "medium",
				"schedule": "medium",
			},
		}
		next_world["inbox"].append(delegated_message)

	next_world["worldSummary"] = WorldStateModel.rebuild_world_summary(next_world)
	return next_world

func _update_mock_policy(world: Dictionary, character_id: String, policy_patch: Dictionary) -> Dictionary:
	var next_world = world.duplicate(true)

	for character in next_world.get("characters", []):
		if character is Dictionary and str(character.get("id", "")) == character_id:
			var next_policy = character.get("policy", {}).duplicate(true)
			for key in policy_patch.keys():
				next_policy[key] = policy_patch[key]
			character["policy"] = next_policy
			character["autonomyProfile"] = PolicyModel.describe_autonomy_profile(next_policy)

	next_world["worldSummary"] = WorldStateModel.rebuild_world_summary(next_world)
	return next_world

func _spawn_mock_followups(world: Dictionary) -> void:
	var tick_count = int(world.get("tickCount", 0))
	var inbox: Array = world.get("inbox", [])

	if tick_count >= 4 and not _has_mock_message(inbox, "msg_followup_maya"):
		inbox.append({
			"id": "msg_followup_maya",
			"characterId": "maya",
			"senderName": "Maya",
			"type": "decision",
			"priority": "urgent",
			"subject": "Client Window Is Closing",
			"body": "I can still preserve the handoff if I spend extra and reroute now.",
			"preview": "I can still preserve the handoff if I spend extra and reroute now.",
			"createdAt": str(world.get("time", "")),
			"createdAtIso": str(world.get("currentTimeIso", "")),
			"requiresResponse": true,
			"suggestedActions": [
				{"id": "approve_spend", "label": "Approve Spend"},
				{"id": "delay_handoff", "label": "Delay Handoff"},
				{"id": "ask_jordan", "label": "Ask Jordan"},
			],
			"consequences": {
				"money": "high",
				"stress": "medium",
				"reputation": "high",
				"schedule": "high",
			},
		})

	if tick_count >= 8 and not _has_mock_message(inbox, "msg_followup_jordan"):
		inbox.append({
			"id": "msg_followup_jordan",
			"characterId": "jordan",
			"senderName": "Jordan",
			"type": "decision",
			"priority": "high",
			"subject": "Pickup Plan Needs Locking",
			"body": "The calendar is getting tighter. If you want family protected, I should commit now.",
			"preview": "The calendar is getting tighter. If you want family protected, I should commit now.",
			"createdAt": str(world.get("time", "")),
			"createdAtIso": str(world.get("currentTimeIso", "")),
			"requiresResponse": true,
			"suggestedActions": [
				{"id": "protect_pickup", "label": "Protect Pickup"},
				{"id": "stay_flexible", "label": "Stay Flexible"},
			],
			"consequences": {
				"relationship": "high",
				"stress": "medium",
				"schedule": "medium",
			},
		})

func _has_mock_message(messages: Array, message_id: String) -> bool:
	for message in messages:
		if message is Dictionary and str(message.get("id", "")) == message_id:
			return true
	return false
