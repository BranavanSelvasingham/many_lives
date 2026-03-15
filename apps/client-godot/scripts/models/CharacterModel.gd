class_name CharacterModel
extends RefCounted

static func from_raw(raw_character: Dictionary, raw_world: Dictionary) -> Dictionary:
    var character_id := str(raw_character.get("id", ""))
    var active_task := _find_task_by_id(raw_world, str(raw_character.get("activeTaskId", "")))
    var next_obligation := _find_next_task(raw_world, character_id)
    var recent_events := _recent_events(raw_world, character_id)
    var policy := PolicyModel.from_raw(raw_character.get("policies", {}))

    return {
        "id": character_id,
        "name": str(raw_character.get("name", "Unknown")),
        "role": _role_label(str(raw_character.get("role", "life"))),
        "subtitle": _role_label(str(raw_character.get("role", "life"))),
        "currentTask": _task_title(active_task, "Reviewing the next block"),
        "currentTaskEnds": _task_time(active_task),
        "location": str(raw_character.get("currentLocation", raw_character.get("homeLocation", "Unknown"))),
        "stress": int(raw_character.get("stress", 0)),
        "energy": int(raw_character.get("energy", 0)),
        "cash": int(raw_character.get("cash", 0)),
        "urgency": _character_urgency(raw_character, raw_world),
        "nextObligation": _next_obligation_label(next_obligation),
        "nextObligationSnippet": _next_obligation_snippet(next_obligation),
        "recentEvents": recent_events,
        "priorities": _priorities(raw_character),
        "autonomyProfile": PolicyModel.describe_autonomy_profile(policy),
        "policy": policy,
        "rawPolicy": raw_character.get("policies", {}).duplicate(true),
        "scheduleSummary": str(raw_character.get("scheduleSummary", "")),
        "load": int(clamp((int(raw_character.get("stress", 0)) + (100 - int(raw_character.get("energy", 0)))) / 2, 0, 100)),
    }

static func _find_task_by_id(raw_world: Dictionary, task_id: String) -> Dictionary:
    if task_id.is_empty():
        return {}

    for task in raw_world.get("tasks", []):
        if task is Dictionary and str(task.get("id", "")) == task_id:
            return task
    return {}

static func _find_next_task(raw_world: Dictionary, character_id: String) -> Dictionary:
    var best_task: Dictionary = {}
    var best_due_at := ""

    for task in raw_world.get("tasks", []):
        if not (task is Dictionary):
            continue
        if str(task.get("characterId", "")) != character_id:
            continue
        if str(task.get("status", "pending")) == "completed":
            continue

        var due_at := str(task.get("dueAt", ""))
        if best_due_at.is_empty() or due_at < best_due_at:
            best_due_at = due_at
            best_task = task

    return best_task

static func _recent_events(raw_world: Dictionary, character_id: String) -> Array:
    var entries: Array = []
    for event in raw_world.get("events", []):
        if not (event is Dictionary):
            continue
        if str(event.get("characterId", "")) != character_id:
            continue
        entries.push_front(str(event.get("title", "")))
        if entries.size() >= 3:
            break

    if entries.is_empty():
        entries = [
            "No major interruptions yet",
            "Routine still holding",
        ]
    return entries

static func _priorities(raw_character: Dictionary) -> Array:
    var priorities: Array = []
    var raw_priority := str(raw_character.get("policies", {}).get("priorityBias", "work"))

    if raw_priority == "family":
        priorities.append("Family")
    else:
        priorities.append(raw_priority.capitalize())

    for obligation in raw_character.get("obligations", []):
        var label := str(obligation).capitalize()
        if not priorities.has(label):
            priorities.append(label)
        if priorities.size() >= 3:
            break
    return priorities

static func _character_urgency(raw_character: Dictionary, raw_world: Dictionary) -> String:
    var stress := int(raw_character.get("stress", 0))
    var highest_message_priority := _highest_message_priority(str(raw_character.get("id", "")), raw_world)

    if highest_message_priority in ["urgent", "high"]:
        return highest_message_priority
    if stress >= 80:
        return "urgent"
    if stress >= 60:
        return "high"
    if int(raw_character.get("energy", 100)) <= 35:
        return "normal"
    return "low"

static func _highest_message_priority(character_id: String, raw_world: Dictionary) -> String:
    var best_rank := 4
    var best_label := "low"

    for message in raw_world.get("inbox", []):
        if not (message is Dictionary):
            continue
        if str(message.get("characterId", "")) != character_id:
            continue
        if message.get("resolvedAt", null) != null:
            continue

        var priority := InboxMessageModel.priority_label(str(message.get("priority", "medium")))
        var rank := InboxMessageModel.priority_rank(priority)
        if rank < best_rank:
            best_rank = rank
            best_label = priority
    return best_label

static func _role_label(raw_role: String) -> String:
    match raw_role:
        "office-worker-parent":
            return "Office worker parent"
        "freelancer":
            return "Freelancer"
        "student":
            return "Student"
        _:
            return raw_role.replace("-", " ").capitalize()

static func _task_title(task: Dictionary, fallback: String) -> String:
    if task.is_empty():
        return fallback
    return str(task.get("title", fallback))

static func _task_time(task: Dictionary) -> String:
    if task.is_empty():
        return ""
    return WorldStateModel.format_time(str(task.get("dueAt", "")))

static func _next_obligation_label(task: Dictionary) -> String:
    if task.is_empty():
        return "No immediate obligation"
    return "%s at %s" % [
        str(task.get("title", "Upcoming task")),
        WorldStateModel.format_time(str(task.get("dueAt", ""))),
    ]

static func _next_obligation_snippet(task: Dictionary) -> String:
    if task.is_empty():
        return "No pressure queued"
    return str(task.get("description", str(task.get("title", "Upcoming task"))))
