class_name InboxMessageModel
extends RefCounted

static func from_raw(raw_message: Dictionary, raw_world: Dictionary) -> Dictionary:
    var sender_name := str(raw_message.get("senderName", WorldStateModel.character_name(raw_world, str(raw_message.get("characterId", "")))))
    var priority := priority_label(str(raw_message.get("priority", "medium")))
    var message_type := _type_label(str(raw_message.get("type", "alert")), raw_message)
    var created_at_iso := str(raw_message.get("createdAtIso", raw_message.get("createdAt", "")))
    var created_at_display := str(raw_message.get("createdAt", created_at_iso))
    if created_at_display == created_at_iso or created_at_display.contains("T") or created_at_display.contains("-"):
        created_at_display = WorldStateModel.format_time(created_at_display)

    return {
        "id": str(raw_message.get("id", "")),
        "characterId": str(raw_message.get("characterId", "")),
        "senderName": sender_name,
        "type": message_type,
        "priority": priority,
        "subject": str(raw_message.get("subject", "Inbox item")),
        "body": str(raw_message.get("body", "")),
        "preview": _preview(str(raw_message.get("body", ""))),
        "createdAt": created_at_display,
        "createdAtIso": created_at_iso,
        "requiresResponse": bool(raw_message.get("requiresResponse", false)),
        "suggestedActions": _normalize_actions(raw_message.get("suggestedActions", [])),
        "consequences": _consequences(raw_message, priority),
        "snoozedUntil": raw_message.get("snoozedUntil", null),
        "delegatedToCharacterId": str(raw_message.get("delegatedToCharacterId", "")),
        "resolvedAt": raw_message.get("resolvedAt", null),
    }

static func is_visible(raw_message: Dictionary, current_time_iso: String) -> bool:
    if raw_message.get("resolvedAt", null) != null:
        return false

    var snoozed_until = raw_message.get("snoozedUntil", null)
    if snoozed_until == null:
        return true

    return str(snoozed_until) <= current_time_iso

static func filter_messages(messages: Array, filter_name: String, current_time_iso: String = "") -> Array:
    var filtered: Array = []
    for message in messages:
        if not (message is Dictionary):
            continue

        if message.has("resolvedAt") and message.get("resolvedAt", null) != null:
            continue
        if current_time_iso.length() > 0 and not is_visible(message, current_time_iso):
            continue

        match filter_name:
            "Urgent":
                if str(message.get("priority", "low")) not in ["urgent", "high"]:
                    continue
            "Waiting":
                if not bool(message.get("requiresResponse", false)):
                    continue
            "Reports":
                if str(message.get("type", "")) not in ["status", "social"]:
                    continue
            "Opportunities":
                if str(message.get("type", "")) != "opportunity":
                    continue
            _:
                pass
        filtered.append(message)

    filtered.sort_custom(_sort_messages)
    return filtered

static func priority_label(raw_priority: String) -> String:
    match raw_priority:
        "critical":
            return "urgent"
        "urgent":
            return "urgent"
        "high":
            return "high"
        "medium":
            return "normal"
        "normal":
            return "normal"
        "low":
            return "low"
        _:
            return "low"

static func priority_rank(priority: String) -> int:
    match priority:
        "urgent":
            return 0
        "high":
            return 1
        "normal":
            return 2
        _:
            return 3

static func action_id_from_label(label: String) -> String:
    return label.to_lower().replace(" ", "_").replace("-", "_")

static func _normalize_actions(raw_actions: Array) -> Array:
    var actions: Array = []
    for action in raw_actions:
        if action is Dictionary:
            actions.append({
                "id": str(action.get("id", action_id_from_label(str(action.get("label", "Action"))))),
                "label": str(action.get("label", "Action")),
            })
        else:
            var label := str(action)
            actions.append({
                "id": action_id_from_label(label),
                "label": label,
            })
    return actions

static func _consequences(raw_message: Dictionary, priority: String) -> Dictionary:
    if raw_message.has("consequences"):
        return raw_message.get("consequences", {}).duplicate(true)

    if priority == "urgent":
        return {
            "schedule": "high",
            "stress": "medium",
            "money": "medium",
        }
    if priority == "high":
        return {
            "schedule": "medium",
            "stress": "medium",
        }
    return {
        "schedule": "low",
    }

static func _type_label(raw_type: String, raw_message: Dictionary) -> String:
    if bool(raw_message.get("requiresResponse", false)):
        return "decision"

    match raw_type:
        "decision", "status", "opportunity", "social", "interruption":
            return raw_type
        "request":
            return "decision"
        "update":
            return "status"
        "summary":
            return "social"
        _:
            return "interruption"

static func _preview(body: String) -> String:
    if body.length() <= 96:
        return body
    return body.substr(0, 93) + "..."

static func _sort_messages(left: Variant, right: Variant) -> bool:
    var left_message: Dictionary = left
    var right_message: Dictionary = right
    var left_rank := priority_rank(str(left_message.get("priority", "low")))
    var right_rank := priority_rank(str(right_message.get("priority", "low")))

    if left_rank == right_rank:
        return str(left_message.get("createdAtIso", "")) > str(right_message.get("createdAtIso", ""))
    return left_rank < right_rank
