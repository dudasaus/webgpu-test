import shader from "./shader.wsgl?raw";

// VSCode doesn't like gpu.
// @ts-ignore
const gpu = navigator.gpu;

async function main() {
  if (!gpu) {
    console.error("WebGPU not supported.");
    return;
  }
  const adapter = await gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const shaderModule = device.createShaderModule({
    code: shader,
  });

  const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
  const context: any = canvas.getContext("webgpu")!;

  context.configure({
    device: device,
    format: gpu.getPreferredCanvasFormat(),
    alphaMode: "premultiplied",
  });

  const vertices = new Float32Array([
    0.0,
    0.6,
    0,
    1,
    1,
    0,
    0,
    1,
    -0.5,
    -0.6,
    0,
    1,
    0,
    1,
    0,
    1,
    0.5,
    -0.6,
    0,
    1,
    0,
    0,
    1,
    1,
  ]);

  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength, // make it big enough to store vertices in
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);

  const vertexBuffers = [
    {
      attributes: [
        {
          shaderLocation: 0, // position
          offset: 0,
          format: "float32x4",
        },
        {
          shaderLocation: 1, // color
          offset: 16,
          format: "float32x4",
        },
      ],
      arrayStride: 32,
      stepMode: "vertex",
    },
  ];

  const pipelineDescriptor = {
    vertex: {
      module: shaderModule,
      entryPoint: "vertex_main",
      buffers: vertexBuffers,
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragment_main",
      targets: [
        {
          format: gpu.getPreferredCanvasFormat(),
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
    layout: "auto",
  };

  const renderPipeline = device.createRenderPipeline(pipelineDescriptor);
  const commandEncoder = device.createCommandEncoder();
  const clearColor = { r: 0.0, g: 0.5, b: 1.0, a: 1.0 };

  const renderPassDescriptor = {
    colorAttachments: [
      {
        clearValue: clearColor,
        loadOp: "clear",
        storeOp: "store",
        view: context.getCurrentTexture().createView(),
      },
    ],
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(renderPipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.draw(3);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
}

main();
