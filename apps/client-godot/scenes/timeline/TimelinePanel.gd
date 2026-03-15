extends PanelContainer

signal new_game_requested
signal tick_requested(minutes: int)

const PILL_TAG_SCENE = preload("res://scenes/shared/PillTag.tscn")

@onready var clock_label: Label = $Margin/VBox/Header/Clock
@onready var attention_label: Label = $Margin/VBox/Header/Attention
@onready var thread_label: Label = $Margin/VBox/Header/Threads
@onready var backend_label: Label = $Margin/VBox/Header/Backend
@onready var summary_label: Label = $Margin/VBox/Content/SummaryBox/Summary
@onready var obligations_container: VBoxContainer = $Margin/VBox/Content/ObligationsBox/Obligations
@onready var risk_container: HFlowContainer = $Margin/VBox/Content/RiskBox/Risks
@onready var new_game_button: Button = $Margin/VBox/Controls/NewGameButton
@onready var tick_30_button: Button = $Margin/VBox/Controls/Tick30Button
@onready var tick_120_button: Button = $Margin/VBox/Controls/Tick120Button
@onready var status_label: Label = $Margin/VBox/Footer

func _ready() -> void:
    new_game_button.pressed.connect(func() -> void:
        new_game_requested.emit()
    )
    tick_30_button.pressed.connect(func() -> void:
        tick_requested.emit(30)
    )
    tick_120_button.pressed.connect(func() -> void:
        tick_requested.emit(120)
    )

func set_busy(is_busy: bool) -> void:
    new_game_button.disabled = is_busy
    tick_30_button.disabled = is_busy
    tick_120_button.disabled = is_busy

func set_world_state(world_state: Dictionary, error_text: String, source_label: String) -> void:
    backend_label.text = source_label

    if world_state.is_empty():
        clock_label.text = "No game loaded"
        attention_label.text = "0 urgent"
        thread_label.text = "0 threads"
        summary_label.text = "Create a new game to begin triage."
        status_label.text = error_text if not error_text.is_empty() else "Waiting for a new game."
        return

    var summary: Dictionary = world_state.get("worldSummary", {})
    clock_label.text = str(world_state.get("time", "No time"))
    attention_label.text = "%d urgent" % int(summary.get("urgentCount", 0))
    thread_label.text = "%d active threads" % int(summary.get("activeThreads", 0))
    summary_label.text = str(world_state.get("summary", ""))

    _populate_obligations(summary.get("upcomingObligations", []))
    _populate_risks(summary.get("risks", {}))

    status_label.text = "Tick %d | %s" % [
        int(world_state.get("tickCount", 0)),
        error_text if not error_text.is_empty() else "Simulation stable",
    ]

func _populate_obligations(obligations: Array) -> void:
    for child in obligations_container.get_children():
        child.queue_free()

    if obligations.is_empty():
        var label := Label.new()
        label.text = "No immediate obligations."
        obligations_container.add_child(label)
        return

    for obligation in obligations:
        var label := Label.new()
        label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        label.text = "- %s" % str(obligation)
        obligations_container.add_child(label)

func _populate_risks(risks: Dictionary) -> void:
    for child in risk_container.get_children():
        child.queue_free()

    for risk_name in ["money", "relationship", "health", "schedule"]:
        var tag = PILL_TAG_SCENE.instantiate()
        tag.set_tag("%s %s" % [risk_name.capitalize(), str(risks.get(risk_name, "low")).to_upper()], risk_name)
        risk_container.add_child(tag)
