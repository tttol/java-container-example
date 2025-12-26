package io.github.tttol.conex.controller;

import io.github.tttol.conex.model.User;
import io.github.tttol.conex.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

@Controller
@RequiredArgsConstructor
public class HomeController {

    private final UserService userService;

    @GetMapping("/")
    public String index(Model model) {
        final List<User> users = userService.getAllUsers();
        model.addAttribute("users", users);
        return "index";
    }
}
