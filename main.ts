//Basic Hello World 
let strString : string = "Hello World"

//Switch message when button pressed
input.onButtonPressed(Button.A, function () {
    strString = "Hello World"
})
input.onButtonPressed(Button.B, function () {
    strString = "Love MicroBit"
})
input.onButtonPressed(Button.AB, function () {
    strString = "WTF?"     
})

basic.forever(function () {
	basic.showString(strString)
})
