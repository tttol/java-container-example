package io.github.tttol.conex;

import org.springframework.boot.SpringApplication;

public class TestConexApplication {

	public static void main(String[] args) {
		SpringApplication.from(ConexApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
