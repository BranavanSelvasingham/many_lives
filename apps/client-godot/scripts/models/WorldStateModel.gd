class_name WorldStateModel
extends RefCounted

static func normalize(raw_world: Dictionary) -> Dictionary:
    if raw_world.is_empty():
        return {}

    if raw_world.has("gameId") and raw_world.has("worldSummary"):
        var normalized = raw_world.duplicate(true)
        if not normalized.has("currentTimeIso"):
            normalized["currentTimeIso"] = str(raw_world.get("time", ""))
        normalized["time"] = format_time(str(normalized.get("currentTimeIso", normalized.get("time", ""))))
        normalized["worldSummary"] = rebuild_world_summary(normalized)
        return normalized

    var current_time_iso = str(raw_world.get("currentTime", ""))
    var normalized_characters: Array = []
    for raw_character in raw_world.get("characters", []):
        if raw_character is Dictionary:
            normalized_characters.append(CharacterModel.from_raw(raw_character, raw_world))

    var normalized_inbox: Array = []
    for raw_message in raw_world.get("inbox", []):
        if not (raw_message is Dictionary):
            continue
        if not InboxMessageModel.is_visible(raw_message, current_time_iso):
            continue
        normalized_inbox.append(InboxMessageModel.from_raw(raw_message, raw_world))

    var normalized_world = {
        "gameId": str(raw_world.get("id", raw_world.get("gameId", ""))),
        "scenarioName": str(raw_world.get("scenarioName", "Many Lives")),
        "time": format_time(current_time_iso),
        "currentTimeIso": current_time_iso,
        "tickCount": int(raw_world.get("tickCount", 0)),
        "summary": str(raw_world.get("summary", "Your lives are moving even when you are not watching.")),
        "characters": normalized_characters,
        "inbox": normalized_inbox,
    }
    normalized_world["worldSummary"] = rebuild_world_summary(normalized_world, raw_world)
    return normalized_world

static func rebuild_world_summary(normalized_world: Dictionary, raw_world: Dictionary = {}) -> Dictionary:
    var active_messages := InboxMessageModel.filter_messages(
        normalized_world.get("inbox", []),
        "All",
        str(normalized_world.get("currentTimeIso", "")),
    )
    var urgent_count := 0
    for message in active_messages:
        if str(message.get("priority", "low")) in ["urgent", "high"]:
            urgent_count += 1

    return {
        "urgentCount": urgent_count,
        "activeThreads": active_messages.size(),
        "upcomingObligations": _upcoming_obligations(normalized_world, raw_world),
        "risks": {
            "money": _money_risk(active_messages, raw_world),
            "relationship": _relationship_risk(active_messages, raw_world),
            "health": _health_risk(normalized_world),
            "schedule": _schedule_risk(active_messages, raw_world),
        },
    }

static func build_mock_world(game_id: String) -> Dictionary:
    var characters := [
        {
            "id": "jordan",
            "name": "Jordan",
            "role": "Office worker parent",
            "subtitle": "Office worker parent",
            "currentTask": "Morning standup prep",
            "currentTaskEnds": "12:30",
            "location": "Home office",
            "stress": 58,
            "energy": 51,
            "cash": 120,
            "urgency": "high",
            "nextObligation": "School pickup at 15:30",
            "nextObligationSnippet": "Family logistics will collide with office time later today.",
            "recentEvents": [
                "Slept lightly",
                "Manager asked for a tighter budget pass",
                "School reminder came in early",
            ],
            "priorities": ["Family", "Job stability", "Health"],
            "autonomyProfile": "Medium autonomy, important only interruption, strict schedule protection",
            "policy": {
                "autonomy": "medium",
                "spendWithoutAsking": 140,
                "spendPreset": "custom",
                "interruptWhen": "important_only",
                "priorityBias": "family",
                "riskTolerance": "balanced",
                "scheduleProtection": "strict",
                "reportingFrequency": "standard",
                "escalationSensitivity": "normal",
                "ruleSummary": "Protect family commitments when work starts to sprawl.",
            },
            "rawPolicy": {
                "riskTolerance": 0.35,
                "spendingLimit": 140,
                "escalationThreshold": 3,
                "reportingFrequency": "normal",
                "priorityBias": "family",
            },
            "scheduleSummary": "Balancing office work with school logistics and household handoffs.",
            "load": 53,
        },
        {
            "id": "maya",
            "name": "Maya",
            "role": "Freelancer",
            "subtitle": "Freelancer",
            "currentTask": "Client handoff prep",
            "currentTaskEnds": "13:00",
            "location": "Studio apartment",
            "stress": 62,
            "energy": 57,
            "cash": 230,
            "urgency": "urgent",
            "nextObligation": "Client handoff at 13:00",
            "nextObligationSnippet": "The delivery thread is live right now.",
            "recentEvents": [
                "Vendor slipped the schedule",
                "Cash flow is stable for now",
                "Client is waiting on assets",
            ],
            "priorities": ["Work", "Money", "Health"],
            "autonomyProfile": "High autonomy, emergencies only interruption, flexible schedule protection",
            "policy": {
                "autonomy": "high",
                "spendWithoutAsking": 200,
                "spendPreset": "200",
                "interruptWhen": "emergencies_only",
                "priorityBias": "money",
                "riskTolerance": "aggressive",
                "scheduleProtection": "flexible",
                "reportingFrequency": "minimal",
                "escalationSensitivity": "low",
                "ruleSummary": "",
            },
            "rawPolicy": {
                "riskTolerance": 0.75,
                "spendingLimit": 200,
                "escalationThreshold": 5,
                "reportingFrequency": "low",
                "priorityBias": "money",
            },
            "scheduleSummary": "Protecting client reputation without burning the whole day on one crisis.",
            "load": 52,
        },
        {
            "id": "leo",
            "name": "Leo",
            "role": "Student",
            "subtitle": "Student",
            "currentTask": "Campus commute",
            "currentTaskEnds": "12:45",
            "location": "Dorm stop",
            "stress": 46,
            "energy": 66,
            "cash": 48,
            "urgency": "normal",
            "nextObligation": "Chemistry lab at 13:00",
            "nextObligationSnippet": "Lab is still manageable if the commute holds.",
            "recentEvents": [
                "Bus board is slipping",
                "Group project still quiet",
                "Shift starts tonight",
            ],
            "priorities": ["Work", "School", "Relationships"],
            "autonomyProfile": "Medium autonomy, important only interruption, flexible schedule protection",
            "policy": {
                "autonomy": "medium",
                "spendWithoutAsking": 50,
                "spendPreset": "50",
                "interruptWhen": "important_only",
                "priorityBias": "work",
                "riskTolerance": "balanced",
                "scheduleProtection": "flexible",
                "reportingFrequency": "detailed",
                "escalationSensitivity": "high",
                "ruleSummary": "",
            },
            "rawPolicy": {
                "riskTolerance": 0.45,
                "spendingLimit": 50,
                "escalationThreshold": 2,
                "reportingFrequency": "high",
                "priorityBias": "work",
            },
            "scheduleSummary": "Trying to keep school, a shift, and basic wellbeing from colliding.",
            "load": 40,
        },
    ]

    var world := {
        "gameId": game_id,
        "scenarioName": "Busy Day Prototype",
        "time": format_time("2026-03-16T12:00:00.000Z"),
        "currentTimeIso": "2026-03-16T12:00:00.000Z",
        "tickCount": 0,
        "summary": "Three lives are already in motion. The inbox is where the unstable parts surface.",
        "characters": characters,
        "inbox": [
            {
                "id": "msg_1",
                "characterId": "maya",
                "senderName": "Maya",
                "type": "decision",
                "priority": "urgent",
                "subject": "Delivery Conflict",
                "body": "The supplier is delayed by about two hours. If I wait, I will likely miss the client handoff.",
                "preview": "The supplier is delayed by about two hours. If I wait, I will likely miss the client handoff.",
                "createdAt": "2026-03-16 11:50",
                "createdAtIso": "2026-03-16T11:50:00.000Z",
                "requiresResponse": true,
                "suggestedActions": [
                    {"id": "switch_vendor", "label": "Switch Vendor"},
                    {"id": "wait_2h", "label": "Wait 2h"},
                    {"id": "reschedule_handoff", "label": "Reschedule Handoff"},
                    {"id": "ask_jordan", "label": "Ask Jordan"},
                ],
                "consequences": {
                    "money": "medium",
                    "stress": "low",
                    "reputation": "high",
                    "relationship": "none",
                    "schedule": "high",
                },
            },
            {
                "id": "msg_2",
                "characterId": "jordan",
                "senderName": "Jordan",
                "type": "decision",
                "priority": "high",
                "subject": "Pickup Coverage Question",
                "body": "If the budget review slips this afternoon, I should lock the family plan now instead of hoping it works itself out.",
                "preview": "If the budget review slips this afternoon, I should lock the family plan now instead of hoping it works itself out.",
                "createdAt": "2026-03-16 11:55",
                "createdAtIso": "2026-03-16T11:55:00.000Z",
                "requiresResponse": true,
                "suggestedActions": [
                    {"id": "protect_pickup", "label": "Protect Pickup"},
                    {"id": "stay_flexible", "label": "Stay Flexible"},
                    {"id": "ask_maya", "label": "Ask Maya"},
                ],
                "consequences": {
                    "stress": "medium",
                    "relationship": "high",
                    "schedule": "medium",
                },
            },
            {
                "id": "msg_3",
                "characterId": "leo",
                "senderName": "Leo",
                "type": "status",
                "priority": "normal",
                "subject": "Late Bus to Campus",
                "body": "The campus shuttle is drifting. I should still make lab, but setup time is getting thinner.",
                "preview": "The campus shuttle is drifting. I should still make lab, but setup time is getting thinner.",
                "createdAt": "2026-03-16 11:45",
                "createdAtIso": "2026-03-16T11:45:00.000Z",
                "requiresResponse": false,
                "suggestedActions": [
                    {"id": "acknowledge", "label": "Acknowledge"},
                    {"id": "call_rideshare", "label": "Call a Rideshare"},
                ],
                "consequences": {
                    "money": "low",
                    "stress": "medium",
                    "schedule": "medium",
                },
            },
        ],
    }
    world["worldSummary"] = rebuild_world_summary(world)
    return world

static func build_mock_summary(world: Dictionary, action_id: String = "", override_text: String = "") -> String:
    var summary := "Attention is distributed across three unstable lives."
    if not action_id.is_empty():
        summary += " Last decision: %s." % action_id.replace("_", " ")
    if not override_text.is_empty():
        summary += " Override sent: %s." % override_text
    return summary

static func format_time(raw_time: String) -> String:
    if raw_time.is_empty():
        return "No time"

    var normalized := raw_time.replace(" ", "T")
    if normalized.contains("T"):
        var parts := normalized.split("T")
        if parts.size() == 2:
            var date_part := parts[0]
            var time_part := parts[1].replace("Z", "")
            if time_part.contains("."):
                time_part = time_part.split(".")[0]
            if time_part.length() >= 5:
                return "%s %s" % [_weekday_label(date_part), time_part.substr(0, 5)]
    return raw_time

static func add_minutes(iso_time: String, minutes: int) -> String:
    if iso_time.is_empty():
        return ""
    var unix_time := Time.get_unix_time_from_datetime_string(_normalized_datetime_string(iso_time))
    var adjusted_unix := int(unix_time) + minutes * 60
    var next_time := Time.get_datetime_string_from_unix_time(adjusted_unix, false)
    if next_time.contains(" "):
        next_time = next_time.replace(" ", "T")
    if not next_time.ends_with("Z"):
        next_time += "Z"
    return next_time

static func character_name(world: Dictionary, character_id: String) -> String:
    for character in world.get("characters", []):
        if character is Dictionary and str(character.get("id", "")) == character_id:
            return str(character.get("name", ""))
    return ""

static func message_character_id(world: Dictionary, message_id: String) -> String:
    for message in world.get("inbox", []):
        if message is Dictionary and str(message.get("id", "")) == message_id:
            return str(message.get("characterId", ""))
    return ""

static func _upcoming_obligations(normalized_world: Dictionary, raw_world: Dictionary) -> Array:
    var obligations: Array = []

    if not raw_world.is_empty():
        for task in raw_world.get("tasks", []):
            if not (task is Dictionary):
                continue
            if str(task.get("status", "pending")) == "completed":
                continue
            var due_at := format_time(str(task.get("dueAt", "")))
            obligations.append("%s at %s" % [
                str(task.get("title", "Upcoming task")),
                due_at,
            ])
            if obligations.size() >= 3:
                break
    else:
        for character in normalized_world.get("characters", []):
            if character is Dictionary:
                var obligation := str(character.get("nextObligation", ""))
                if not obligation.is_empty():
                    obligations.append(obligation)
            if obligations.size() >= 3:
                break
    return obligations

static func _schedule_risk(active_messages: Array, raw_world: Dictionary) -> String:
    var schedule_pressure := _highest_consequence(active_messages, "schedule")
    if schedule_pressure == "high":
        return "high"
    if schedule_pressure == "medium":
        return "medium"
    if raw_world.has("tasks"):
        var mandatory_count := 0
        for task in raw_world.get("tasks", []):
            if task is Dictionary and bool(task.get("mandatory", false)):
                if str(task.get("status", "pending")) in ["pending", "active"]:
                    mandatory_count += 1
        if mandatory_count >= 2:
            return "high"
        if mandatory_count == 1:
            return "medium"
    return "low"

static func _money_risk(active_messages: Array, raw_world: Dictionary) -> String:
    var consequence := _highest_consequence(active_messages, "money")
    if consequence != "none":
        return consequence

    if raw_world.has("tasks"):
        for task in raw_world.get("tasks", []):
            if task is Dictionary and str(task.get("kind", "")) == "money":
                return "medium"
    return "low"

static func _relationship_risk(active_messages: Array, raw_world: Dictionary) -> String:
    var consequence := _highest_consequence(active_messages, "relationship")
    if consequence != "none":
        return consequence

    if raw_world.has("tasks"):
        for task in raw_world.get("tasks", []):
            if task is Dictionary and str(task.get("kind", "")) == "family":
                return "medium"
    return "low"

static func _health_risk(normalized_world: Dictionary) -> String:
    for character in normalized_world.get("characters", []):
        if not (character is Dictionary):
            continue
        if int(character.get("stress", 0)) >= 80 or int(character.get("energy", 100)) <= 30:
            return "high"
        if int(character.get("stress", 0)) >= 65 or int(character.get("energy", 100)) <= 45:
            return "medium"
    return "low"

static func _normalized_datetime_string(raw_time: String) -> String:
    var normalized := raw_time.strip_edges()
    normalized = normalized.replace(" ", "T")
    normalized = normalized.replace("Z", "")
    if normalized.contains("."):
        normalized = normalized.split(".")[0]
    return normalized

static func _weekday_label(date_part: String) -> String:
    var parts := date_part.split("-")
    if parts.size() < 3:
        return date_part

    var year := int(parts[0])
    var month := int(parts[1])
    var day := int(parts[2])
    var offsets := [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
    if month < 3:
        year -= 1

    var weekday := int((year + int(year / 4) - int(year / 100) + int(year / 400) + offsets[month - 1] + day) % 7)
    var labels := ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    return labels[weekday]

static func _highest_consequence(messages: Array, key: String) -> String:
    var best_score := -1
    var best_label := "none"

    for message in messages:
        if not (message is Dictionary):
            continue
        var label := str(message.get("consequences", {}).get(key, "none"))
        var score := _risk_score(label)
        if score > best_score:
            best_score = score
            best_label = label

    return best_label

static func _risk_score(label: String) -> int:
    match label:
        "high":
            return 3
        "medium":
            return 2
        "low":
            return 1
        _:
            return 0
