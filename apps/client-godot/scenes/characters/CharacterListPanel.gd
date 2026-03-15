extends PanelContainer

signal character_selected(character_id: String)

const CHARACTER_CARD_SCENE = preload("res://scenes/characters/CharacterCard.tscn")

@onready var summary_label: Label = $Margin/VBox/Header/Summary
@onready var card_container: VBoxContainer = $Margin/VBox/Scroll/Content
@onready var empty_label: Label = $Margin/VBox/Scroll/Content/EmptyLabel
@onready var stress_bar: StatBar = $Margin/VBox/Footer/StressBar
@onready var load_bar: StatBar = $Margin/VBox/Footer/LoadBar

func set_characters(characters: Array, selected_character_id: String) -> void:
    for child in card_container.get_children():
        if child != empty_label:
            child.queue_free()

    empty_label.visible = characters.is_empty()
    summary_label.text = "%d lives active" % characters.size()

    var total_stress := 0
    var total_load := 0
    var under_pressure := 0

    for character in characters:
        if not (character is Dictionary):
            continue

        total_stress += int(character.get("stress", 0))
        total_load += int(character.get("load", 0))
        if str(character.get("urgency", "low")) in ["urgent", "high"]:
            under_pressure += 1

        var card = CHARACTER_CARD_SCENE.instantiate()
        card_container.add_child(card)
        card.selected.connect(_on_character_selected)
        card.set_character(character, str(character.get("id", "")) == selected_character_id)

    if characters.size() > 0:
        stress_bar.set_stat("Average stress", float(total_stress) / float(characters.size()), "high")
        load_bar.set_stat("Attention load", float(total_load) / float(characters.size()), "normal")
        summary_label.text = "%d lives active | %d running hot" % [characters.size(), under_pressure]
    else:
        stress_bar.set_stat("Average stress", 0, "low")
        load_bar.set_stat("Attention load", 0, "low")

func _on_character_selected(character_id: String) -> void:
    character_selected.emit(character_id)
