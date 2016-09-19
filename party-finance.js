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
		.value(function(d) { return d.payment_sum; }),

	ARC = d3.svg.arc()
		.startAngle(function(data_group) {
			return data_group.x;
		})
		.endAngle(function(data_group) { return data_group.x + data_group.dx ; })
		.padAngle(.01).padRadius(RADIUS / 3)
		.innerRadius(function(data_group) { return RADIUS / 3 * data_group.depth; })
		.outerRadius(function(data_group) { return RADIUS / 3 * (data_group.depth + 1) - 1; });

var EXPENSE_CODES = {
	"1000": "Сума витрат виборчого фонду (1100 + 1200 + 1300 + 1400)",
	"1100": "Виготовлення матеріалів передвиборної агітації (1110 + 1120 + 1130 + 1140 + 1150)",
	"1110": "Виготовлення друкованих матеріалів",
	"1120": "Виготовлення відеозаписів",
	"1130": "Виготовлення аудіозаписів",
	"1140": "Виготовлення предметів, матеріалів (сувенірів, канцтоварів тощо), що містять символіку партії",
	"1150": "Придбання канцтоварів, паперу, інших предметів і матеріалів для виготовлення матеріалів передвиборної агітації",
	"1200": "Використання засобів масової інформації (1210 + 1220):",
	"1210": "Оплата ефірного часу (1211 + 1212)",
	"1211": "Оплата ефірного часу на телебаченні",
	"1212": "Оплата ефірного часу на радіо",
	"1220": "Публікування агітаційних матеріалів у друкованих засобах масової інформації",
	"1300": "Інші послуги, пов’язані з проведенням передвиборної агітації (1310 + 1320 + 1330 + 1340 + 1350 + 1360):",
	"1310": "Транспортні послуги для реалізації заходів передвиборної агітації",
	"1320": "Оренда будинків і приміщень для проведення публічних заходів",
	"1330": "Оренда обладнання та технічних засобів для ведення передвиборної агітації",
	"1340": "Оренда приміщень усіх форм власності для проведення публічних заходів",
	"1350": "Виготовлення (оренда) рекламних щитів",
	"1360": "Послуги зв’язку (1361 + 1362)",
	"1361": "Послуги електричного зв’язку",
	"1362": "Послуги поштового зв’язку",
	"1400": "Інші витрати на передвиборну агітацію (зокрема розміщення агітації на носіях зовнішньої реклами)",
	};


function rename_nested(data_group_input) {
	var data_group = data_group_input;
	if (data_group.key !== undefined) {
		data_group.name = data_group.key;
		delete data_group.key;
	}

	if (typeof data_group.values !== "undefined") {
		data_group.children = jQuery.each(data_group.values, function(index, value) {
			var subreturn = rename_nested(value);
			return subreturn;
		});
		delete data_group.values;
	}
	return data_group;
}


function append_sums(data_group) {
	var payment_total = 0;
	if (typeof data_group.children !== "undefined") {
		data_group.children = jQuery.each(data_group.children, function(index, value) {
			var result = append_sums(value);
			payment_total += float(result[1]);
			return result[0];
		});
		data_group.payment_sum = payment_total;
	} else {
		data_group.payment_sum = float(data_group.payment_sum);
	}
	return [data_group, payment_total || data_group.payment_sum];
}


function calculate_fill(data_group) {
	var local_data = data_group;
	var fill;
	while (local_data.depth > 1) {
		local_data = local_data.parent;
	}
	if (local_data.depth === 0) {
		local_data = local_data.children[0];
	}
	if (local_data.name && local_data.name.length === 4) {
		fill = switch_color(local_data.name);
	} else if (local_data.parent.name.length === 4) {
		fill = switch_color(local_data.parent.name);
	} else {
		fill = switch_color(local_data.parent.parent.name);
	}
	fill.l = luminance(fill, data_group.payment_sum);
	return fill;
}


function switch_color(code) {
	var fill;
	switch (code) {
	case "1211":
		fill = d3.lab(COLORS[0]);
		break;
	case "1212":
		fill = d3.lab(COLORS[1]);
		break;
	case "1400":
		fill = d3.lab(COLORS[2]);
		break;
	case "1110":
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


function key_function(data_group) {
	var keys = [], current = data_group;
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
				{ title: "Рахунок партії", data: 'source_bank_account' },
				{ title: "Адресат платежу", data: 'target_entity' },
				{ title: "Призначення платежу", data: 'purpose' },
				{ title: "Код витрат", data: 'code' },
				{ title: "Дата", data: 'date' },
				{ title: "Сума", data: 'payment_sum' },
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
		"Телебачення",
		"Радіо",
		"Зовнішня реклама",
		"Виготовлення друкованої агітації",
		"Інші витрати"
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
function zoomIn(data_group) {
	var data = data_group;
	if (!data.children){
		if (data.parent) {
			data = data.parent;
		} else {
			return;
		}
	}
	zoom(data);
}


function zoomOut(data_group) {
	if (!data_group.parent){
		return;
	}
	zoom(data_group.parent);
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
			.key(function(d) { return d.target_entity; })
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
