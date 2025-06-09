export function TailwindTest() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Tailwind v4 is Working!</h1>
      
      <div className="bg-blue-500 text-white p-4 rounded-lg mb-4">
        This box should have a blue background with white text.
      </div>
      
      <div className="flex gap-4">
        <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition">
          Green Button
        </button>
        <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition">
          Red Button
        </button>
      </div>
      
      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="border p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Card 1</h3>
          <p className="text-gray-600">This is a card with Tailwind styling.</p>
        </div>
        <div className="border p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Card 2</h3>
          <p className="text-gray-600">Another card with the same styling.</p>
        </div>
      </div>
    </div>
  )
}