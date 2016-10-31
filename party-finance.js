var ZOOMOUT_TEXT = 'повернутися',
	SELECT_PARTY_TEXT = "виберіть партію";

var DATA_NESTED,
	DATA_TABLE,
	PARTY_SELECTED = 0,
	PATHS_SELECTION,
	DATATABLE = false,
	WIDTH = 550,
	HEIGHT = 550,
	RADIUS = Math.min(WIDTH, HEIGHT) / 2 - 100,
	LOGO_HEIGHT = 321,
	DRAWING,
	CENTER,
	COLORS = ['#00B6BE', '#FA963C', '#AFE6FA', '#1b9e77', '#666666'],
	PARTITION = d3.layout.partition()
		.sort(null)
		.size([2 * Math.PI, RADIUS])
		.value(function(d) { return d.sum; }),

	ARC = d3.svg.arc()
		.startAngle(function(d) {
			return d.x;
		})
		.endAngle(function(d) { return d.x + d.dx ; })
		.padAngle(.01).padRadius(RADIUS / 3)
		.innerRadius(function(d) { return RADIUS / 3 * d.depth; })
		.outerRadius(function(d) { return RADIUS / 3 * (d.depth + 1) - 1; });

var EXPENSE_CODES = {
	"3.1":"Виготовлення агітаційних матеріалів (3.1.1 + 3.1.2 + 3.1.3 + 3.1.4 + 3.1.5)",
	"3.1.1":"Друкованих матеріалів (плакатів, листівок, буклетів та інших агітаційних матеріалів)",
	"3.1.2":"Відеозаписів",
	"3.1.3":"Аудіозаписів",
	"3.1.4":"Предметів, матеріалів (сувенірів, канцтоварів тощо)",
	"3.1.5":"Придбання канцтоварів, паперу, інших предметів і матеріалів",
	"3.2":"Використання засобів масової інформації (3.2.1 + 3.2.2 + 3.2.3)",
	"3.2.1":"Оплата ефірного часу на ТБ",
	"3.2.2":"Оплата ефірного часу на радіо",
	"3.2.3":"Публікування матеріалів у друкованих засобах масової інформації",
	"3.3":"Інші послуги (3.3.1 + 3.3.2 + 3.3.3 + 3.3.4 + 3.3.5 + 3.3.6 + 3.3.7)",
	"3.3.1":"Транспортні послуги",
	"3.3.2":"Оренда будинків і приміщень",
	"3.3.3":"Оренда обладнання та технічних засобів",
	"3.3.4":"Виготовлення (оренда) агітаційних наметів",
	"3.3.5":"Послуги зв’язку",
	"3.3.6":"Комунальні послуги",
	"3.3.7":"Програмне забезпечення",
	"3.4":"Витрати на зовнішню рекламу (3.4.1+3.4.2)",
	"3.4.1":"Виготовлення (оренда) рекламних щитів",
	"3.4.2":"Витрати на розміщення зовнішньої реклами",
	"3.5":"Оплата праці (3.5.1 + 3.5.2)",
	"3.5.1":"Заробітна плата",
	"3.5.2":"Гонорари, в точу числі за надані консультаційні послуги",
	"3.6":"Сплата податків",
	"3.6.1":"Податок на доходи (із зарплати)",
	"3.6.2":"Сплата ЄСВ",
	"3.6.3":"Військовий збір",
	"3.6.4":"Інші податки",
	"3.7":"Інші витрати",
	"3.8":"Переведення коштів на інші рахунки партії чи кандидатів",
	};


function rename_nested(data_input) {
	var d = data_input;
	if (d.key !== undefined) {
		d.name = d.key;
		delete d.key;
	}

	if (typeof d.values !== "undefined") {
		d.children = jQuery.each(d.values, function(index, value) {
			var subreturn = rename_nested(value);
			return subreturn;
		});
		delete d.values;
	}
	return d;
}


function append_sums(d) {
	var payment_total = 0;
	if (typeof d.children !== "undefined") {
		d.children = jQuery.each(d.children, function(index, value) {
			var result = append_sums(value);
			payment_total += float(result[1]);
			return result[0];
		});
		d.sum = payment_total;
	} else {
		d.sum = float(d.sum);
	}
	return [d, payment_total || d.sum];
}


function calculate_fill(d) {
	var local_data = d;
	var fill;
	while (local_data.depth > 1) {
		local_data = local_data.parent;
	}
	if (local_data.depth === 0) {
		local_data = local_data.children[0];
	}
	if (local_data.name && (local_data.name.length === 3 || local_data.name.length === 5)) {
		fill = switch_color(local_data.name);
	} else if (local_data.parent.name.length === 3 || local_data.parent.name.length === 5) {
		fill = switch_color(local_data.parent.name);
	} else {
		fill = switch_color(local_data.parent.parent.name);
	}
	fill.l = luminance(fill, d.sum);
	return fill;
}


function switch_color(code) {
	var fill;
	switch (code) {
	case "3.3.2":
		fill = d3.lab(COLORS[0]);
		break;
	case "3.2.1":
		fill = d3.lab(COLORS[1]);
		break;
	case "3.1.1":
		fill = d3.lab(COLORS[2]);
		break;
	case "3.5.1":
		fill = d3.lab(COLORS[3]);
		break;
	default:
		fill = d3.lab(COLORS[4]);
		break;
	}
	return fill;
}


function luminance(fill, data) {
	var lum = fill.l;
	return d3.scale.sqrt()
		.domain([0, 1e6])
		.clamp(true)
		.range([90, lum])(data);
}


function float(value) {
	// TODO: isNaN?
	if (typeof value != "number") {
		return parseFloat(value);
	}
	return value;

}


function key_function(d) {
	var keys = [], current = d;
	while (current.depth) {
		keys.push(current.id || current.name);
		current = current.parent;
	}
	return keys.reverse().join(".");
}


function tween(datum, index, current_attribute_value) {
	return function(t) {
		return (-LOGO_HEIGHT * t) + "px";
	};
}


function draw_circle(data) {
	if (DRAWING === undefined) {
		init_drawing();
		LOGO_HEIGHT = $('#logo').height();
		d3.select('#logo').transition().delay(800).duration(750).ease('quad').styleTween('margin-top', tween).remove();
	}

	DRAWING.selectAll("path").remove();

	PATHS_SELECTION = DRAWING.selectAll("path")
		.data(PARTITION.nodes(data, key_function).slice(1))
		.attr("display", function(d) { return d.depth ? null : "none"; }).enter();

	PATHS_SELECTION = PATHS_SELECTION.append("path")
		.attr("d", ARC)
		.attr("id", key_function)
		.on("click", zoomIn)
		.style("fill", calculate_fill);

	PATHS_SELECTION.on("mouseover", function() {
			var name;
			if (this.__data__.name && EXPENSE_CODES[this.__data__.name]) {
				name = EXPENSE_CODES[this.__data__.name];
			} else {
				name = (this.__data__.name || this.__data__.purpose);
			}
			d3.select(".legendtext").html("<p class='exp_text'>" + name + ": </p>" + float(this.__data__.value).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,') + " грн.");
			d3.select(this).style("stroke-width", 2)
				.style('stroke', 'white');
			})
		.on("mouseleave", function() {
			d3.select(".legendtext").html("Наведіть на сегмент, щоб побачити опис та суму витрат");
			d3.select(this).style("stroke-width", 'none')
				.style('stroke', 'none');
			});
}


function populate_party_selector(data) {
	var selector = jQuery("#party_select");
	selector.append($("<option>"));

	jQuery.each(data, function(index, value) {
		selector.append($("<option>", {
			value: index,
			text: value.key
		}));
	});
	$('#party_select').select2({
		  placeholder: SELECT_PARTY_TEXT
	});
}


function draw_table(input_data){
	if (DATATABLE) {
		DATATABLE.destroy();
	}

	DATATABLE = $('#expenses').DataTable( {
			language: {
				"sLengthMenu":		"Показати _MENU_ записів",
				"sZeroRecords":		"Записи відсутні.",
				"sInfo":			"Записи з _START_ по _END_ із _TOTAL_ записів",
				"sInfoEmpty":		"Записи з 0 по 0 із 0 записів",
				"sInfoFiltered":	"(відфільтровано з _MAX_ записів)",
				"sInfoPostFix":		"",
				"sSearch":			"Пошук:",
				"sUrl":				"",
				"oPaginate": {
					"sFirst":		"Перша",
					"sPrevious":	"Попередня",
					"sNext": 		"Наступна",
					"sLast": 		"Остання"
				},
				"oAria": {
					"sSortAscending":	": активувати для сортування стовпців за зростанням",
					"sSortDescending":	": активувати для сортування стовпців за спаданням"
				}
			},
			data: input_data,
			columns: [
				{ title: "Рахунок партії", data: 'source_bank_account_number' },
				{ title: "Адресат платежу", data: 'target_legal_personality' },
				{ title: "Призначення платежу", data: 'purpose' },
				{ title: "Код витрат", data: 'code' },
				{ title: "Дата", data: 'date' },
				{ title: "Сума", data: 'sum' },
			],
		});
}


function filter(datatable) {
	yadcf.init(datatable, [{
			column_number: 1,
			select_type: 'select2',
			filter_default_label: 'Оберіть значення'
		}, {
			column_number: 3,
			select_type: 'select2',
			filter_default_label: 'Усі'
		}, {
			column_number: 4,
			filter_type: "date",
			date_format: "yyyy-mm-dd",
			filter_default_label: 'Оберіть дату',
		}, {
			column_number: 5,
			filter_type: "range_number_slider",
			filter_reset_button_text: false
	}]);

	$( "#yadcf-filter--expenses-4" ).datepicker('option', 'minDate', new Date(2014, 9-1, 22) );
	$( "#yadcf-filter--expenses-4" ).datepicker('option', 'maxDate', new Date(2014, 10-1, 31) );
}


function draw_legend() {
	var colors_descriptions = [
		"Оренда приміщень",
		"Телебачення",
		"Виготовлення друкованої агітації",
		"Зарплата",
		"Решта витрат"
	];

	var legend_list = jQuery(".colors_legend");
	for (var i = 0; i < COLORS.length; i++) {
		legend_list.append(
			jQuery("<li>")
				.text(colors_descriptions[i])
				.prepend(
					jQuery("<div>")
						.addClass("color")
						.css("background-color", COLORS[i])
				)
		);
	}
}


// ---- zoom ----
function zoomIn(d) {
	var data = d;
	if (!data.children){
		if (data.parent) {
			data = data.parent;
		} else {
			return;
		}
	}
	zoom(data);
}


function zoomOut(d) {
	if (!d.parent){
		return;
	}
	zoom(d.parent);
}


function zoom(new_root) {
	if (document.documentElement.__transition__) return;

	draw_circle(new_root);
	CENTER.datum(new_root);
}


$(document).ready(function() {
	d3.json("assets/expenses.json", function(error, root) {
		if (error) throw error;

		DATA_NESTED = d3.nest()
			.key(function(d) { return d.account_party; })
			.key(function(d) { return d.code; })
			.key(function(d) { return d.target_legal_personality; })
			.entries(root);

		DATA_NESTED = $.each(DATA_NESTED, function(index, value) {
			return rename_nested(value)[0];
		});
		DATA_NESTED = jQuery.each(DATA_NESTED, function(index, value) {
			return append_sums(value)[0];
		});

		DATA_TABLE = d3.nest()
			.key(function(d) { return d.account_party; })
			.entries(root);

		populate_party_selector(DATA_TABLE);

		PARTY_SELECTED = 0;
	});

	jQuery('#party_select')
		.on('change', function() {
			PARTY_SELECTED = parseInt(jQuery(this).val());
			if (PARTY_SELECTED == -1) {
				jQuery('#circle_container').hide();
			} else {
				jQuery('#circle_container').show();
				update();
			}
		});
});


function update() {
	draw_circle(DATA_NESTED[PARTY_SELECTED]);
	CENTER.datum(DATA_NESTED[PARTY_SELECTED]);
	d3.select(".image").html("<img src='assets/images/" + PARTY_SELECTED + ".png'>");
	draw_table(DATA_TABLE[PARTY_SELECTED]["values"]);
	filter(DATATABLE);
}


function init_drawing() {
	DRAWING = d3.select(".svg").append("svg")
		.attr("width", WIDTH)
		.attr("height", HEIGHT)
		.append("g")
		.attr("transform", "translate(" + WIDTH / 2 + "," + HEIGHT * .5 + ")");

	CENTER = DRAWING.append("circle")
		.attr("r", RADIUS / 3)
		.classed("center", true)
		.on("click", zoomOut);
	CENTER.append('title').text(ZOOMOUT_TEXT);

	d3.select(".legendtext").html("Наведіть на сегмент, щоб побачити опис та суму витрат");
	draw_legend();
}
