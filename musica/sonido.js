var v = document.getElementsByTagName("audio")[0];
v.volume = 0.01;

var sound = false;

var boton = document.getElementById("boton");
boton.addEventListener("click", function(){
	if (!sound) {
		v.play();
		sound = true;
	} else {
		v.pause();
		sound = false;
	}
});
 
 