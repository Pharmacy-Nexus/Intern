let state = {
  questions: [],
  current: 0,
  answers: {},
  mode: "practice"
}

// 🧠 API call
async function getExam(topics, count){

  let res = await fetch("http://localhost:3000/generate-exam",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      topics,
      count,
      difficulty:"all"
    })
  })

  let data = await res.json()
  return data.exam
}

// 🚀 start
async function start(){

  let topics = document.getElementById("topics").value.split(",")
  let count = Number(document.getElementById("count").value)
  state.mode = document.getElementById("mode").value

  state.questions = await getExam(topics, count)
  state.current = 0
  state.answers = {}

  render()
}

// 🧠 render question
function render(){

  let q = state.questions[state.current]

  let html = `
    <h3>${state.current+1}) ${q.question}</h3>
  `

  if(q.caseScenario){
    html += `<div class="case">${q.caseScenario}</div>`
  }

  q.options.forEach(opt=>{
    html += `
      <button onclick="selectAnswer('${opt}')">${opt}</button>
    `
  })

  html += `<br><br>`

  if(state.mode === "practice"){
    html += `<button onclick="showAnswer()">Show Answer</button>`
  }

  html += `<button onclick="next()">Next</button>`

  html += `<div id="extra"></div>`

  document.getElementById("exam").innerHTML = html
}

// 🧠 select
function selectAnswer(ans){
  state.answers[state.current] = ans
}

// 🧠 show answer
function showAnswer(){

  let q = state.questions[state.current]

  document.getElementById("extra").innerHTML = `
    <p><b>Correct:</b> ${q.correctAnswer}</p>
    <p>${q.explanation}</p>
    <div class="summary">${q.summary}</div>
  `
}

// 🧠 next
function next(){

  if(state.current < state.questions.length -1){
    state.current++
    render()
  }else{
    finish()
  }
}

// 🧠 finish
function finish(){

  if(state.mode === "exam"){
    let correct = 0

    state.questions.forEach((q,i)=>{
      if(state.answers[i] === q.correctAnswer) correct++
    })

    document.getElementById("exam").innerHTML = `
      <h2>Result 🔥</h2>
      <p>${correct} / ${state.questions.length}</p>
      <button onclick="location.reload()">Retry</button>
    `
  }else{
    alert("Practice Done 👌")
  }
}
